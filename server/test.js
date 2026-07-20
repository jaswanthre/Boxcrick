const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://jami01091999_db_user:Daddyok99@cluster0.znyue8i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log("Connected successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();