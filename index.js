const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5001;

app.get('/', (req, res) => {
  res.send('Hello World!')
})


//middleware
app.use(cors());
app.use(express.json());

//verify token
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({message: 'Invalid authorization'});
  }

  const token = authorization?.split(' ')[1];
  jwt.verify(token, process.env.ASSESS_SECRET, (err, decoded) => {
    if(err){
      return res.status(403).send({message: 'Forbidden access'});
    }
    req.decoded = decoded;
    next();
  })
}


//mongodb configuration
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const req = require('express/lib/request');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5qssgbo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // create a collection of ducuments
    const bookCollections = client.db("BookInventory").collection("books");
    const usersCollections = client.db("BookInventory").collection("users");
    const cartCollections = client.db("BookInventory").collection("cart");
    const paymentCollections = client.db("BookInventory").collection("payments");
    const enrolledCollections = client.db("BookInventory").collection("enrolled");
    const appliedCollections = client.db("BookInventory").collection("applied");

    //routes for users
    app.post('/api/set-token', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ASSESS_SECRET, {
        expiresIn: '24h'
      });
      res.send({token})
    })


    // middleware for admin and instructor
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollections.findOne(query);
      if(user.role === 'admin'){
        next();
      }else{
        return res.status(401).send({message: 'Forbidden access'})
      }
    }

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollections.findOne(query);
      if(user.role === 'instructor'){
        next();
      }else{
        return res.status(401).send({message: 'Unauthorized access'})
      }
    }

    app.post('/new-user', async (req, res) => {
      const newUser = req.body;
      const result = await usersCollections.insertOne(newUser);
      res.send(result);
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollections.find({}).toArray();
      res.send(result);
    });

    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    app.get('/user/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    app.delete('/delete-user/:id',verifyJWT,verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await usersCollections.deleteOne(query);
      res.send(result);
    })

    app.put('/update-user/:id',verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert: true};
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.option,
          about: updatedUser.about,
          photoUrl: updatedUser.photoUrl
        }
      }

    const result = await usersCollections.updateOne(filter, updateDoc, options);
    res.send(result);
    })




    // insert a book to the db: post method
    app.post('/upload-book', async(req, res) => {
      const data = req.body;
      const result = await bookCollections.insertOne(data);
      res.send(result);
    })

    //get all books from database
    // app.get('/all-books', async(req, res) => {
    //   const books = await bookCollections.find();
    //   const result = await books.toArray();
    //   res.send(result);
    // })

    //update a book data : path or update methods
    app.patch('/book/:id', async(req, res) => {
      const id = req.params.id;
      // console.log(id);
      const updateBookData = req.body;
      const filter = {_id: new ObjectId(id)};
      const options = { upsert: true};

      const updateDoc = {
        $set: {
          ...updateBookData
        }
      }
      // update
      const result = await bookCollections.updateOne(filter, updateDoc, options);
      res.send(result);
    })

    //delete a book data
    app.delete('/book/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await bookCollections.deleteOne(filter);
      res.send(result);
    })

    //find by category
    app.get('/all-books', async(req, res) => {
      let query = {};
      if(req.query?.category){
        query = {category: req.query.category}
      }
      const result = await bookCollections.find(query).toArray();
      res.send(result);
    })

    // to get single book data
    app.get('/book/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await bookCollections.findOne(filter);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})