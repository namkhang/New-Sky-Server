var express = require('express');
var router = express.Router();
var fs_lib = require('fs')
var xlsx = require('node-xlsx')
var multer = require('multer');
const { log } = require('console');
const Logger = require('nodemon/lib/utils/log');
const pdf = require('pdf-parse');
var nodemailer = require("nodemailer")
var db = require("../mongo/mongo_model");
const { now } = require('mongoose');

let upload = multer({
  dest : './public/uploads'
})

/* GET home page. */
router.get('/get-passenger', async function(req, res, next) {

    let data = await db.Immigration.aggregate([
      {
        $group: {
          _id: { name: "$name", ref_number : "$ref_number" , gender: "$gender" ,  dayofbirth: "$dayofbirth" ,  country: "$country" ,  flightcode: "$flightcode" ,  start_date: "$start_date" , end_date: "$end_date" ,remainingDate : "$remainingDate" }, 
          doc: { $first: "$$ROOT" } 
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }  
      }
    ])
    res.json(data)


});

/* GET home page. */
router.get('/daily-update', async function(req, res, next) {
  let now = new Date()
  let data = await db.Immigration.find()
  data.forEach(async i => {
    await db.Immigration.updateOne({_id : i._id} , {remainingDate : Math.ceil((new Date(i.end_date.split("/")[2] , parseInt(i.end_date.split("/")[1]) - 1 , i.end_date.split("/")[0]) - now) / (1000 * 60 * 60 * 24)) }) 
  })
  res.json("success")


});





router.get('/send-mail', async function(req, res, next) {
  let now = new Date()
  let warning  = []
  let data = await db.Immigration.aggregate([
    {
      $group: {
        _id: { name: "$name",ref_number : "$ref_number", gender: "$gender" ,  dayofbirth: "$dayofbirth" ,  country: "$country" ,  flightcode: "$flightcode" ,  start_date: "$start_date" , end_date: "$end_date" }, 
        doc: { $first: "$$ROOT" } 
      }
    },
    {
      $replaceRoot: { newRoot: "$doc" }  
    }
  ])
  data = data.filter(i => new Date(i.start_date.split("/")[2] , parseInt(i.start_date.split("/")[1]) - 1 , i.start_date.split("/")[0]) < now && new Date(i.end_date.split("/")[2] , parseInt(i.end_date.split("/")[1]) - 1 , i.end_date.split("/")[0]) >= now) 
  data.forEach(it => {
    let remainingDate = Math.ceil((new Date(it.end_date.split("/")[2] , parseInt(it.end_date.split("/")[1]) - 1 , it.end_date.split("/")[0]) - now) / (1000 * 60 * 60 * 24)) 
    if(remainingDate <= 15){
          warning.push({name : it.name , ref_number : it.ref_number, gender : it.gender, country : it.country, flightcode : it.flightcode, start_date : it.start_date , end_date : it.end_date ,remainingDate})
    }
  })


  let transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    tls :{
      rejectUnauthorized : false
    },
    auth: {
      user: "namkhangnguyendang@gmail.com",
      pass: "kmnzqfbdguiwntjy",
    }   
})

let warningRow = warning.map(wn => 

  parseInt(wn.remainingDate) < 6 ? `
  <tr>
    <td style="background-color: red;">${wn.name}</td>
    <td style="background-color: red;">${wn.ref_number}</td>
    <td style="background-color: red;">${wn.gender}</td>
    <td style="background-color: red;">${wn.country}</td>
    <td style="background-color: red;">${wn.flightcode}</td>
    <td style="background-color: red;">${wn.start_date}</td>
    <td style="background-color: red;">${wn.end_date}</td>
    <td style="background-color: red;">${wn.remainingDate}</td>
  </tr>
`
:
  6 <= parseInt(wn.remainingDate) &&  parseInt(wn.remainingDate) <= 10 ?
 `
  <tr>
    <td style="background-color: yellow;">${wn.name}</td>
    <td style="background-color: yellow;">${wn.ref_number}</td>
    <td style="background-color: yellow;">${wn.gender}</td>
    <td style="background-color: yellow;">${wn.country}</td>
    <td style="background-color: yellow;">${wn.flightcode}</td>
    <td style="background-color: yellow;">${wn.start_date}</td>
    <td style="background-color: yellow;">${wn.end_date}</td>
    <td style="background-color: yellow;">${wn.remainingDate}</td>
  </tr>
`
:
`
  <tr>
    <td>${wn.name}</td>
    <td>${wn.ref_number}</td>
    <td">${wn.gender}</td>
    <td">${wn.country}</td> 
    <td>${wn.flightcode}</td>
    <td>${wn.start_date}</td>
    <td>${wn.end_date}</td>
    <td>${wn.remainingDate}</td>
  </tr>
`

).join('');


let emailHTML = `
  <html>
  <head>
    <style>
      table {
        width: 100%;
        border-collapse: collapse;
      }
      table, th, td {
        border: 1px solid black;
      }
      th, td {
        padding: 10px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
      }
      tr:nth-child(even) {
        background-color: #f9f9f9;
      }
    </style>
  </head>
  <body>
    <h2>Danh sách khách hàng còn số ngày nhập cảnh ít hơn 15 ngày</h2>
    <table>
      <thead>
        <tr>
          <th>Tên Khách Hàng</th>
          <th>Số QLXNC</th>
          <th>Giới tính</th>
          <th>Quốc gia</th>
          <th>Mã hộ chiếu</th>
          <th>Ngày nhập cảnh</th>
          <th>Ngày kết thúc nhập cảnh</th>
          <th>Số ngày nhập cảnh còn lại</th>
        </tr>
      </thead>
      <tbody>
        ${warningRow}
      </tbody>
    </table>
  </body>
  </html>
`;
  let option = {
    from: "namkhangnguyendang@gmail.com",
    to: `trinhngocthang26011@gmail.com,hoaithanh2005ht@gmail.com,trangdt0701@gmail.com,Danghongtham1505@gmail.com`,
    subject: "Đã đến hạn!!!",
    html: emailHTML,
  };
  await transport.sendMail(option)  
  res.json("success")

});



router.post('/uploadexcel' ,upload.array('files'), async (req,res)=>{
  try {
    let now = new Date()
    if(req.body.type === "multiple"){
      for(let fs = 0 ; fs < req.files.length ; fs ++){
              let response = []
              let dataBuffer = fs_lib.readFileSync(req.files[fs].path);   
              let result = []
              let final = []
              let start = 0
              let data = await pdf(dataBuffer)        
              let entries = data.text.split("\n").filter(x => x != "")
              let refNumber = entries.filter(i => i.includes("Số(Our Ref"))[0].replace(". No" , "").replace(": No" , "").split(":")[1].trim()
              for(let i = 0 ; i < entries.length ; i ++){
                    if ( i == entries.length - 1){
                      break
                    }
                    else{
                      if (entries[i].toLocaleLowerCase().includes("persons are granted single entries") == true || entries[i].toLocaleLowerCase().includes("CỤC QLXNC".toLocaleLowerCase()) == true ){
                        start = i
                        }
                      else{
                            if(entries[i + 1].toLocaleLowerCase().includes("persons are granted single entries") || entries[i + 1].toLocaleLowerCase().includes("CỤC QLXNC".toLocaleLowerCase()) == true ){
                              result.push(entries.slice(start , i + 1))
                            }
                            else{
                              continue
                            }
                }
                    }
        }   
            
    
        result.splice(0 , 1)
        

       for(let c2 = 0 ; c2 < result.length ; c2 ++){        
        if(result[c2].filter(i => i.includes("Male") || i.includes("Female"))[0].match(/(Female|Male)(\d{2}\/\d{2}\/\d{4})([A-Za-z\s\(\)]+?)([A-Z]*\d+)/) === null){
            let index = result[c2].findIndex(i => i.includes("Male") || i.includes("Female"))
            
            result[c2][index] = `${result[c2][index]} ${result[c2][index + 1]}${result[c2][index+2]}`
        }
       }

       
              
              for(let it  = 0 ; it < result.length ; it++){
                    let format = [...result[it]]
                    format= format.filter(i => i.includes("following persons are granted") || i === i.toUpperCase() && i .includes("QLXNC") === false || i.includes("Female") || i.includes("Male") )
                    let userInfor = {}
                    let name = []
                    let gender = []
                    let dayofbirth = []
                    let country = []
                    let flightcode = []
                    for(let it = 0 ; it < format.length ; it++){
                            if(format[it].includes("following persons are granted")){
                              userInfor["start_date"] = format[it].match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/)[1]
                              userInfor["end_date"] = format[it].match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/)[2]
                            }
                            else if (format[it] === format[it].toUpperCase()){
                                      if(isNaN(Number(format[it])) === true){
                                          if(format[it + 1] === format[it + 1].toUpperCase()){
                                            
                                            name.push(`${format[it]} ${format[it + 1]}`)
                                            format.splice(it + 1,1)
                                          }
                                          else{
                                            name.push(`${format[it]}`)
                                          }
                                            
                                      }
                                      else{
                                        continue
                                      }
                            }
                            else{                              
                              gender.push(format[it].match(/(Female|Male)(\d{2}\/\d{2}\/\d{4})([A-Za-z\s\(\)]+?[a-z\)])([A-Z0-9].*)/)[1])
                              dayofbirth.push(format[it].match(/(Female|Male)(\d{2}\/\d{2}\/\d{4})([A-Za-z\s\(\)]+?[a-z\)])([A-Z0-9].*)/)[2])
                              country.push(format[it].match(/(Female|Male)(\d{2}\/\d{2}\/\d{4})([A-Za-z\s\(\)]+?[a-z\)])([A-Z0-9].*)/)[3])
                              flightcode.push(format[it].match(/(Female|Male)(\d{2}\/\d{2}\/\d{4})([A-Za-z\s\(\)]+?[a-z\)])([A-Z0-9].*)/)[4])
                            }
                    }
                    userInfor["name"] = name
                    userInfor["gender"] = gender
                    userInfor["dayofbirth"] = dayofbirth
                    userInfor["country"] = country
                    userInfor["flightcode"] = flightcode
                    final.push(userInfor)
                    
                    
              }
              

              final = final.filter(i => i.name.length > 0)
              for(let c = 0 ; c < final.length ; c ++){              
                  if(Object.keys(final[c]).length === 5){
                    final[c].start_date = final[c - 1].start_date
                    final[c].end_date = final[c - 1].end_date
                    console.log(final[c]);
                    
                  }
                  else{
                      continue
                  }
              }
               
              
              for(let i = 0 ; i < final.length ; i++){
                    for(let j = 0 ; j < final[i].name.length ; j++){
                      let remainingDate = Math.ceil((new Date(final[i].end_date.split("/")[2] , parseInt(final[i].end_date.split("/")[1]) - 1 , final[i].end_date.split("/")[0]) - now) / (1000 * 60 * 60 * 24)) 
                        response.push({name : final[i].name[j] , ref_number : refNumber, gender : final[i].gender[j] , dayofbirth : final[i].dayofbirth[j] ,country : final[i].country[j],flightcode : final[i].flightcode[j], start_date :  final[i].start_date, end_date :  final[i].end_date  , remainingDate})
                    }
              }

              
              

              

              for(let e = 0 ; e < response.length ; e++){
                await db.Immigration.create({name : response[e].name ,ref_number : refNumber,  gender : response[e].gender , dayofbirth : response[e].dayofbirth , country : response[e].country ,flightcode : response[e].flightcode, start_date : response[e].start_date , end_date : response[e].end_date , remainingDate : response[e].remainingDate})
              
              } 
              
         }

         let dataRes =  await db.Immigration.aggregate([
          {
            $group: {
              _id: { name: "$name",ref_number : "$ref_number",  gender: "$gender" ,  dayofbirth: "$dayofbirth" ,  country: "$country" ,  flightcode: "$flightcode" ,  start_date: "$start_date" , end_date: "$end_date" , remainingDate: "$remainingDate" }, 
              doc: { $first: "$$ROOT" } 
            }
          },
          {
            $replaceRoot: { newRoot: "$doc" }  
          }
        ])
        res.json(dataRes);
   
    }
  else if (req.body.type === "single"){
    for(let fs = 0 ; fs < req.files.length ; fs ++){
        let dataBuffer = fs_lib.readFileSync(req.files[fs].path);
        let response = []
        let data = await pdf(dataBuffer)
          let entries = data.text.split("\n").filter(x => x != "")
          let refNumber = entries.filter(i => i.includes("Số(Our Ref"))[0].replace(". No" , "").replace(": No" , "").split(":")[1].trim()
          
          let start = entries.findIndex(i => i.includes("requesting permission granted"))
          if(!entries[start + 1].includes("follows")){
                let start_date =  entries[start + 7].trim().match(/từ ngày (\d{2}\/\d{2}\/\d{4}) đến ngày (\d{2}\/\d{2}\/\d{4})/)[1]
                let end_date = entries[start + 7].trim().match(/từ ngày (\d{2}\/\d{2}\/\d{4}) đến ngày (\d{2}\/\d{2}\/\d{4})/)[2]
                let remainingDate = Math.ceil((new Date(end_date.split("/")[2] , parseInt(end_date.split("/")[1]) - 1 , end_date.split("/")[0]) - now) / (1000 * 60 * 60 * 24))
                response.push({name : entries[start + 3] ,ref_number : refNumber,  gender : entries[start + 11].trim().split(" ")[1] === "Bà" ? "Female" : "Male" , dayofbirth : entries[start + 4].trim().split(":")[1] ,  country : entries[start + 5].trim().split(":")[1] , flightcode : entries[start + 6].trim().split(":")[1], start_date , end_date , remainingDate })
                for(let e = 0 ; e < response.length ; e++){
                  await db.Immigration.create({name : response[e].name ,ref_number : refNumber,  gender : response[e].gender , dayofbirth : response[e].dayofbirth , country : response[e].country ,flightcode : response[e].flightcode, start_date : response[e].start_date , end_date : response[e].end_date , remainingDate : response[e].remainingDate})
                }

          }
          else{
                let start_date =  entries[start + 6].trim().match(/từ ngày (\d{2}\/\d{2}\/\d{4}) đến ngày (\d{2}\/\d{2}\/\d{4})/)[1]
                let end_date = entries[start + 6].trim().match(/từ ngày (\d{2}\/\d{2}\/\d{4}) đến ngày (\d{2}\/\d{2}\/\d{4})/)[2]
                let remainingDate = Math.ceil((new Date(end_date.split("/")[2] , parseInt(end_date.split("/")[1]) - 1 , end_date.split("/")[0]) - now) / (1000 * 60 * 60 * 24))
                response.push({name : entries[start + 2] , gender : entries[start + 10].trim().split(" ")[1] === "Bà" ? "Female" : "Male" , dayofbirth : entries[start + 3].trim().split(":")[1] , country : entries[start + 4].trim().split(":")[1] , flightcode : entries[start + 5].trim().split(":")[1], start_date , end_date, remainingDate})
                for(let e = 0 ; e < response.length ; e++){
                  await db.Immigration.create({name : response[e].name ,ref_number : refNumber,  gender : response[e].gender , dayofbirth : response[e].dayofbirth , country : response[e].country ,flightcode : response[e].flightcode, start_date : response[e].start_date , end_date : response[e].end_date , remainingDate : response[e].remainingDate})
                }
               
          }  
}

      
        let dataRes =  await db.Immigration.aggregate([
          {
            $group: {
              _id: { name: "$name",ref_number : "$ref_number",  gender: "$gender" ,  dayofbirth: "$dayofbirth" ,  country: "$country" ,  flightcode: "$flightcode" ,  start_date: "$start_date" , end_date: "$end_date" , remainingDate : "$remainingDate" }, 
              doc: { $first: "$$ROOT" } 
            }
          },
          {
            $replaceRoot: { newRoot: "$doc" }  
          }
        ])

        res.json(dataRes);

      }
      else{
          console.log("vao đây");
          
      }

            
  }
  catch (err){
        console.log(err);
        
        res.json("kiem tra format file")
  }

})



module.exports = router;
