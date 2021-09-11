import express, { json } from "express";
import { createClient } from 'graphqurl';
import cors from "cors";

import USID from "usid";
const app = express();

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(cors());

import dotenv from 'dotenv';
dotenv.config();

// generating random slug for a url.
const usid = new USID();

// Default length
const len = 8;



// initiating a client with the api endpoint and key
const client = createClient({
  endpoint: 'https://clever-moth-80.hasura.app/v1/graphql',
  headers: {
    'x-hasura-admin-secret': process.env.ADMIN_SECRET
  }
});


app.get("/", (req,res) => {
    res.json({
        message : "This is a Url Shortner using nodejs and Hasura."
    });
});

// returns the url of the corrosponding slug
app.get("/:slug",async (req,res)=>{
    
    const slug = req.params.slug;
    // This var 'found' will change to true if we have a url corrosponding to this slug
    // in our data base.
    var found = false;
    // this holds the data recieved by the api
    var data = [];

    // this is the graphql query to hasura
   await client.query(
        {
          query: `query ($slug : String) {
            fullUrls(where: {slug: {_eq: $slug} }) {
              fullUrl
            }
          }`,
          variables: { slug: slug }
        }
      ).then((response) => {

        // Get hold of the data in the response and check if it is empty or not,
        // if it is not empty that means we have a url for this slug and we return this url
        // if it is empty then we don't have this slug in our data base and return a 'not found' response

            // console.log(response.data.fullUrls);
            data = response.data.fullUrls;
            if(data.length !== 0){
                found = true;
                data = data[0].fullUrl;
                // console.log(data);
            }
        })
       .catch((error) => {
        //    if we get any error we log them
        console.log(error);
      });

      if(found){
          res.status(200).json({message : {
              fullUrl : data
          }});
      } else {
          res.status(404).json({message : "Not found"});
      }
});


// at this endpoint we recieve a post request , which has a url(required) and slug(optional) in its body
app.post("/url", async (req,res)=>{
   
    // if we have slug for this url in the request body we will store this slug in our database corrosponding to the url

    // if we don't have a slug in our body then we generate a new slug for it and save it in the database

    const {slug , url} = req.body;

    // this 'shortUrl' is the variable that will be finally be our slug to the url passed in the request.
    var shortUrl = slug;
    if(!slug){
        shortUrl = usid.uuid(len);
    }

    // first we check if this url is already existing in our database.
    // if it is present then we simply return the slug in our database.
    // if it is not present in our databse then we perform a mutation to hasura to add this to our database
    var found = false;
    var data = [];
   await client.query(
        {
          query: `query ($fullUrl : String) {
            fullUrls(where: {fullUrl: {_eq: $fullUrl} }) {
              slug
            }
          }`,
          variables: { fullUrl: url }
        }
      ).then((response) => {
        //   todo destructure into a variable
        //   console.log(response.data);
            data = response.data.fullUrls;
            if(data.length !== 0){
                found = true;
                data = data[0].slug;
                shortUrl = data;
                // console.log(data);
            }
        })
       .catch((error) => {
        console.log(error);
      });

      if(found){
        res.status(200).json({
            message : "slug already exists.",
            fullUrl : url,
            slug : shortUrl
        });
      }else {
        // now we haven't found this url in our database so we create this entry in our database
        // via mutation to hasura

        // this is the query
       await client.query(
            {
              query: `mutation ($fullUrl : String , $slug : String) {
                insert_fullUrls_one(object: {fullUrl: $fullUrl , slug: $slug}) {
                  slug
                  fullUrl
                }
              }`,
              variables: {
                  fullUrl: url,
                  slug : shortUrl
                },
            },
          ).then((response) => {
            //   console.log(response);
              console.log("Mutation done successfully");
            })
           .catch((error) => {
            console.log(error.errors);
          });
          res.status(200).json({
            message : "Slug Created",
            fullUrl : url,
            slug : shortUrl
        });
      }
})



const PORT = process.env.PORT || "5000";
app.listen(PORT,()=>{
    console.log("server started at : "+ PORT);
});