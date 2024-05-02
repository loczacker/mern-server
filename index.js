import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import userRouter from './routers/UserRouter.js';
import authRouter from './routers/AuthRouter.js'

const app = express();
const port = process.env.PORT || 5001;

//middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
});

//mongodb configuration
const uri = "mongodb+srv://mern-book-store:ZScLNe6PIy7LXfq0@cluster0.5qssgbo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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

    app.use('/user', userRouter);
    app.use('/auth', authRouter);

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