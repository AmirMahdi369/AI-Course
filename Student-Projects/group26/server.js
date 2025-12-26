import express from "express";
import fs from 'fs';
import path from 'path';
import bodyParser from "body-parser";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const app = express();


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");  // destination folder
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);  // .jpg / .png
    cb(null, req.body.name + ext);  // Set filename = name from form
  }
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));


const upload = multer({ storage });






app.get("/",(req, res)=>{
    res.render('welcome.ejs');
});

app.get("/register",(req,res)=>{
    res.render('register.ejs'); 
});

app.post("/register",upload.single("image"),(req,res)=>{
    console.log("Name:", req.body.name);
    console.log("Image saved as:", req.file.filename);
    res.redirect('/')
    
})

app.get('/detector', (req, res) => {
  res.render('detector.ejs'); 
});

app.get('/api/images', (req, res) => {
  const imagesDir = path.join(__dirname, 'public/images');

  fs.readdir(imagesDir, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const imageFiles = files.filter(file =>
      file.match(/\.(jpg|jpeg|png)$/i)
    );

    res.json(imageFiles);
  });
});


app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
