const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json())



const uri = `mongodb+srv://${process.env.db_USER}:${process.env.DB_PASS}@cluster0.ye7c1vr.mongodb.net/?retryWrites=true&w=majority`;

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
    // await client.connect();

    const serviceCollection = client.db('save_life').collection('services')
    const userCollection = client.db('save_life').collection('users')
    const blogCollection = client.db('save_life').collection('blogs')
    const createDonRequestCollection = client.db('save_life').collection('createDonRequests')
    const fundingCollection = client.db('save_life').collection('funding')

    // jwt 
    app.post('/jwt', async(req, res)=> {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_ACCESS, {expiresIn: '9h'})
      res.send({token})
    })

    // middlewares
    const verifyToken = (req, res, next)=> {
        if(!req.headers.authorization){
            return res.status(401).send({message: 'unauthorized access'})
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.TOKEN_ACCESS, (error, decoded)=> {
          if(error){
            return res.status(401).send({message: 'unauthorized access'})
          }
          req.decoded = decoded;
          next()
        })
    }

    const verifyAdmin = async (req, res, next)=> {
        const email = req.decoded.email;
        const query = {email: email}
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if(!isAdmin){
          return res.status(403).send({message: 'forbidden access'})
        }
        next()
    }

    const verifyVolunteer = async (req, res, next)=> {
        const email = req.decoded.email;
        const query = {email: email}
        const user = await userCollection.findOne(query);
        const isVolunteer = user?.role === 'volunteer';
        if(!isVolunteer){
          return res.status(403).send({message: 'forbidden access'})
        }
        next()
    }


    // users related 
    app.get('/users', verifyToken, verifyAdmin, async (req, res)=> {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async(req, res)=> {
        const email = req.params.email;
        if(email !== req.decoded.email){
            return res.status(403).send({message: 'forbidden access'})
        }
        const query = {email: email};
        const user = await userCollection.findOne(query)
        let admin = false;
        if(user){
          admin = user?.role === 'admin';
        }
        res.send({admin})
    })

    app.get('/users/volunteer/:email', verifyToken, async(req, res)=> {
        const email = req.params.email;
        if(email !== req.decoded.email){
            return res.status(403).send({message: 'forbidden access'})
        }
        const query = {email: email};
        const user = await userCollection.findOne(query)
        let volunteer = false;
        if(user){
          volunteer = user?.role === 'volunteer';
        }
        res.send({volunteer})
    })

    app.post('/users', async (req, res)=> {
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    app.patch('/users/admin/:id',verifyToken, async(req, res)=> {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
          $set: {
            role: 'admin',
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc)
        res.send(result)
    })

    app.patch('/users/volunteer/:id',verifyToken, async(req, res)=> {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const updatedDoc = {
          $set: {
            role: 'volunteer',
          }
        }
        const result = await userCollection.updateOne(filter, updatedDoc)
        res.send(result)
    })

    app.delete('/users/:id',verifyToken, async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    // create Donation Request 
    app.get('/createDonationRequest', async(req, res)=> {
      const result = await createDonRequestCollection.find().toArray()
      const count = await createDonRequestCollection.estimatedDocumentCount();
      res.send(result)
    })

    app.get('/createDonationRequest/:id', async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await createDonRequestCollection.findOne(query)
      res.send(result)
    })

    app.post('/createDonationRequest', async(req, res)=> {
      const createDonReq = req.body;
      const result = await createDonRequestCollection.insertOne(createDonReq)
      res.send(result)
    })

    app.patch('/createDonationRequest/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          address: item.address,
          date: item.date,
          district: item.district,
          hospitalName: item.hospitalName,
          recipientName: item.recipientName,
          reqMessage: item.reqMessage,
          requesterEmail: item.requesterEmail,
          requesterName: item.requesterName,
          time: item.time,
          upazila: item.upazila,
          photo: item?.photoURL,
          bloodGroup: item.bloodGroup,
        }
      }
      const result = await createDonRequestCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/createDonationRequest/:id', async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await createDonRequestCollection.deleteOne(query);
      res.send(result)
    })

    // blogs 
    app.get('/blogs', async (req, res)=> {
      const result = await blogCollection.find().toArray()
      res.send(result)
    })

    app.post('/blogs', async (req, res)=> {
      const blog = req.body;
      const result = await blogCollection.insertOne(blog)
      res.send(result)
    })

    // funding 
    app.get('/funding', async(req, res)=> {
      const result = await fundingCollection.find().toArray()
      res.send(result)
    })

    app.post('/funding', async(req, res)=> {
      const fund = req.body;
      const result = await fundingCollection.insertOne(fund)
      res.send(result)
    })

    app.post('/create-payment-intent', async(req, res) => {
      const fund = req.body;
      const amount = parseInt(fund * 100);
      console.log(amount, 'amount inside the intent');
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
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


app.get('/', (req, res) => {
    res.send('Save life server is running!')
  })
  
  app.listen(port, () => {
    console.log(`Save life app listening on port ${port}`)
  })