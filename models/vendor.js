const { Schema, model,mongoose } =require('mongoose');

const schema = new mongoose .Schema({
    name: { type: String },
    email: { type: String },
    phoneNumber: { type: Number },
    password:{type:String},
    count:{type:Number},
    image:{type:String},
});

module.exports ={
     vendorModel : mongoose.model('vendor', schema)
} 