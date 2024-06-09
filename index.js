const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require("jsonwebtoken");
const admin = require('firebase-admin');
const port = process.env.PORT || 5001;

const serviceAccount = require('./config/book-mern-stack-firebase-adminsdk-22c6s-ee427e66e2.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.get('/', (req, res) => {
  res.send('Book Server is running!')
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
    await client.connect();

    // create a collection of ducuments
    const bookCollections = client.db("BookInventory").collection("books");
    const usersCollections = client.db("BookInventory").collection("users");
    const cartCollections = client.db("BookInventory").collection("carts");
    const paymentCollections = client.db("BookInventory").collection("payments");

    //routes for users
    app.post('/api/set-token', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ASSESS_SECRET, { expiresIn: '24h' });
      res.send({token})
    })

    // Verify admin
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

    //post new user
    app.post('/new-user', async (req, res) => {
      const newUser = req.body;
      const result = await usersCollections.insertOne(newUser);
      res.send(result);
    })

    //check email
    app.get('/check-email/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollections.findOne({ email: email });
      if (user) {
          res.send({ exists: true });
      } else {
          res.send({ exists: false });
      }
  });
  

    // get all users
    app.get('/users', async (req, res) => {
      const result = await usersCollections.find({}).toArray();
      res.send(result);
    });

    //get user by id
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: id};
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    //get user by email
    app.get('/user/:email' , async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await usersCollections.findOne(query);
      res.send(result);
    });

    //delete a user
    app.delete('/delete-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };

      try {
        // Delete user from MongoDB
        const result = await usersCollections.deleteOne(query);

        if (result.deletedCount === 1) {
          // Delete user from Firebase Authentication
          await admin.auth().deleteUser(id);
          res.send({ message: 'User deleted successfully' });
        } else {
          res.status(404).send({ message: 'User not found' });
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send({ message: 'Failed to delete user' });
      }
    });

    //update user by id
    app.patch('/update-user/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const filter = {_id: id};
      const options = {upsert: true};
      const updateDoc = {
        $set: {
          ...updatedUser
        }
      }

    const result = await usersCollections.updateOne(filter, updateDoc, options);
    res.send(result);
    })
    //BOOK routes
    // insert a book to db
    app.post('/upload-book', async(req, res) => {
      const data = req.body;
      const result = await bookCollections.insertOne(data);
      res.send(result);
    })

    //update a book data : path or update methods
    app.patch('/book/:id', async(req, res) => {
      const id = req.params.id;
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

    //get all books
    app.get('/all-books', async(req, res) => {
      let query = {};
      if(req.query?.category){
        query = {category: req.query.category}
      }
      const result = await bookCollections.find(query).toArray();
      res.send(result);
    })

    // to get single book data by id
    app.get('/book/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const result = await bookCollections.findOne(filter);
      res.send(result);
    })

    // CART Routes
    //add to cart to db
    app.post('/add-to-cart', verifyJWT, async (req, res) => {
      const newCartItem = req.body;
      const result = await cartCollections.insertOne(newCartItem);
      res.send(result);
    })

    //get cart item id for checking if a class is already in cart
    app.get('/cart-item/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      const query = {
        bookId: id,
        userMail: email
      };
      const projection = {bookId: 1};
      const result = await cartCollections.findOne(query, {projection: projection});
      res.send(result);
    })

    // cart into by user email
    app.get('/cart/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {userMail: email};
      const projection = {bookId: 1};
      const carts = await cartCollections.find(query, {projection: projection}).toArray();
      const bookIds = carts.map(cart => new ObjectId(cart.bookId));
      const query2 = {_id: { $in: bookIds}};
      const result = await bookCollections.find(query2).toArray();
      res.send(result);
    })

    //delete cart item
    app.delete('/delete-cart-item/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = {bookId: id};
      const result = await cartCollections.deleteOne(query);
      res.send(result);
    })

    // PAYMENT Routes
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price) * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // post payment info to db
    app.post('/payment-info', verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      const bookId = paymentInfo.bookId;
      const userEmail = paymentInfo.userEmail;
      const singleBookId = req.query.bookId;
        let query;
        if(singleBookId){
          query = {bookId: singleBookId, userMail: userEmail};
        } else {
          query = {bookId: {$in: bookId}};
        }
        
      // const updatedInstructor = await userCollection.find()
      const deletedResult = await cartCollections.deleteMany(query);
      const paymentResult = await paymentCollections.insertOne(paymentInfo);
      res.send({ paymentResult, deletedResult});
    });

    // get payment history
    app.get('/payment-history/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollections.find(query).sort({ date: -1 }).toArray();
      res.send(result);
  })

  //payment history length
  app.get('/payment-history-length/:email', async (req, res) => {
    const email = req.params.email;
    const query = { userEmail: email };
    const total = await paymentCollections.countDocuments(query);
    res.send({ total });
})

  //Admins stats
  app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
    // Get approved classes and pending classes and instructors 
    const totalBook = (await bookCollections.find().toArray()).length;
    const result = {
      totalBook
    }
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