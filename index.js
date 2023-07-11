const express = require('express');
const mongoose = require('mongoose')
const { ApolloServer, gql } = require('apollo-server-express');
const cors = require('cors')
const {vendorModel} = require('./models/vendor');
const sessionModel = require('./models/session')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const redis = require('ioredis')

const publisher = redis.createClient({ host: '127.0.0.1', port: 6379, auth_pass: "P@ssw0rd" });

const moment = require('moment')
const MONGO_URL="mongodb+srv://tecorb:kumartec123@tecorb.juv3dbp.mongodb.net/GraphQL_Node?retryWrites=true&w=majority"
mongoose.connect(MONGO_URL)
.then(() =>console.log('MongoDB Connected Successfully'))
.catch((err)=>console.log('MongoDB Connection Failed'))
const StatusCodes = require('http-status-codes')
const vendorDefs = gql`
scalar Date
scalar Number
type Vendor {
    name:String
    email:String
    phoneNumber:Number 
    createdAt:Date
    updatedAt:Date
    _id:String
    count:Int
    token:String
    image:String
    totalSum:Int
    data:String
}
type VendorDetails {
    vendor:Vendor!
    message:String
    code:Int!
}

type VendorList {
    vendorList:[Vendor!]
    totalCount:Int!
    message:String
    code:Int!
}

input VendorInput {
    name:String
    email:String
    phoneNumber:Number 
    password:String
}

input editVendorInput {
    name:String
    email:String
    phoneNumber:Number 
    image:String
}
input loginInput {
    email:String
    password:String
}
type Query {
    getVendor(ID:ID):VendorDetails!
    vendor(perPage:Int,page:Int):VendorList!
}

type Mutation{
    createVendor(vendorInput:VendorInput):Vendor!
    loginVendor(loginInput:loginInput):VendorDetails!
    deleteVendor(ID:ID!):Boolean
    editVendor(ID:ID!,vendorInput:editVendorInput):Boolean
}`
const vendor_resolvers = {
    Query: {
        getVendor: async (_, ID, userId) => {
            return new Promise(async (resolve, reject) => {
                if (JSON.stringify(userId) === '{}') {
                    reject(new CustomError('Invalid Token', StatusCodes.NON_AUTHORITATIVE_INFORMATION));
                } else {
                    const details = await vendorModel.findById({ _id: userId.id })
                    if (details) {
                        details.name = "ssss"
                        details.count = 12
                        resolve({ vendor: details, message: "Success", code: 200 });
                    } else {
                        reject(new CustomError('Vendor is not exists', StatusCodes.BAD_REQUEST))
                    }
                }
            })
        },
        async vendor(_, count) {
            return new Promise(async (resolve, reject) => {
                try {
                    var limit = count
                    let Array = []
                    const list = await vendorModel.find().sort({ createdAt: -1 }).skip((limit.perPage * limit.page) - limit.perPage).limit(limit.perPage);
                    const totalCount = await vendorModel.count();
                    if (list.length) {
                        list.map((data) => {
                            if (data.name == "Aashu") {
                                data.totalSum = 2
                            }
                            Array.push(data)
                        })
                    }
                    resolve(
                        {
                            totalCount: totalCount,
                            vendorList: Array,
                            message: "Record fetch successfully",
                            code: StatusCodes.OK
                        }
                    );
                } catch (err) {
                    reject(err);
                }
            })

        }
    },
    Mutation: {
        //add
        async createVendor(_, vendorInput) {
            const data = vendorInput
            const { name, email, phoneNumber, password } = data.vendorInput
            const body = {
                "name": name,
                "email": email,
                "phoneNumber": phoneNumber
            }
            const details = await vendorModel.findOne({ email: email });
            if (details) {
                throw new ApolloError('Vendor is already exists')
            } else {
                const pass = bcrypt.hashSync(password, 10);
                body.password = pass;
                const res = await vendorModel.create(body);
                const token = jwt.sign({
                    id: res.id,
                    role: "Vendor",
                    userId: res._id
                }, 'str34eet', { expiresIn: '30d' })
                await sessionModel.create({ role: "Vendor", userId: res._id, status: true, token: token });
                const f = await publisher.lrange("details", 0, -1)
                console.log(f, "redis_______________-----------")
                res.data = f[0]
                res.token = token
                return (res);
            }
        },
        //login
        async loginVendor(_, loginInput) {
            try {
                const input = loginInput
                const details = await vendorModel.findOne({ "email": input.loginInput.email });
                if (details) {
                    var match = bcrypt.compareSync(input.loginInput.password, details.password);
                    if (match == false) {
                        throw new Error('Wrong Password')
                    } else {
                        const token = jwt.sign({
                            id: details.id,
                            role: "Vendor",
                            userId: details._id
                        }, 'str34eet', { expiresIn: '30d' })
                        await sessionModel.create({ role: "Vendor", userId: details._id, status: true, token: token });
                        details.token = token
                        return {
                            vendor: details,
                            message: 'Login successfully',
                            code: 200
                        };
                    }
                } else {
                    throw new Error('Eamil is not Exists')
                }

            } catch (err) {
                console.log(err)

                throw new Error(err.message)
            }
        },
        //edit
        async editVendor(_, ID,) {
           
            const data = ID
            const { name, email, phoneNumber } = data.vendorInput
            const res = (await vendorModel.updateOne({ _id: data.ID }, { name: name, email: email, phoneNumber: phoneNumber })).modifiedCount;
            return res;

        },
        //delete
        async deleteVendor(_, ID) {
            const data = ID
            const id = data.ID
            const res = (await vendorModel.deleteOne({ _id: id })).deletedCount
            return { res };
        },
    }
}

const PORT = process.env.PORT || 5000;
//Apollo server connection
async function startApolloServer() {
    const app = express()
    const server = new ApolloServer({
        typeDefs: vendorDefs,
        resolvers: vendor_resolvers,
        context: ({ req }) => {
            return new Promise(async (resolve, reject) => {
                const authHeader = req.headers.authorization;
                const role = req.headers.role;
                if (authHeader) {
                    try {
                        const decoded = jwt.verify(authHeader, 'str34eet');
                        if (!decoded) {
                            reject(new CustomError('Invalid Token', StatusCodes.BAD_REQUEST));
                        } else {
                            if (!role) {
                                reject(new CustomError('Invalid Role? Role must be [User,Vendor]', StatusCodes.BAD_REQUEST));
                            } else {
                                if (role == decoded.role) {
                                    resolve(decoded);
                                } else {
                                    reject(new CustomError('Invalid Role', StatusCodes.BAD_REQUEST));
                                }
                            }
                        }
                    } catch (err) {
                        reject(new AuthenticationError(err.message));
                    }
                }
                // If there is no authorization header, return an empty object in the context
                resolve({});
            })

        },
    });
    await server.start();
    // Apply any desired middleware to the Express app
    // Example: CORS middleware
    app.use(cors());

    // Apply the Apollo Server middleware to the app
    server.applyMiddleware({ app });
    // Start the server
    app.listen(PORT, () => {
        console.log(`Server ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
}
startApolloServer().catch((err) => {
    console.error('Failed to start Apollo Server:', err);
});