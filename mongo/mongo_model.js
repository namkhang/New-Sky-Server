const mongoose = require("mongoose")
var Schema = mongoose.Schema

var Immigration= new Schema({
    name : {
        type : String 
    },
    ref_number : String,
    gender : {
        type : String 
    },
    dayofbirth : {
        type : String 
    },
    country : {
        type : String 
    },
    flightcode : String,
    start_date : String,
    end_date : String,
    remainingDate : Number
    
})



module.exports.Immigration = mongoose.model("immigration_informations" , Immigration)