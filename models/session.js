const { Schema, model,mongoose } = require('mongoose');


const schema = new mongoose .Schema({
    userId: { type: String },
    role: { type: String },
    token: { type: String },
    status:{type:Boolean}
});

const sessionModel = mongoose.model('Sesion', schema);
module.exports = sessionModel