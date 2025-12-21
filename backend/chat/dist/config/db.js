import mongoose from 'mongoose';
const connectDb = async () => {
    const url = process.env.MONGO_URI;
    if (!url) {
        throw new Error("Mongo_URI is not defined in environment variables");
    }
    try {
        await mongoose.connect(url, {
            dbName: "ChatApp"
        });
        console.log("Connected to MongoDB");
    }
    catch (error) {
        console.error("Failed to connect to MongoDb", error);
        process.exit(1);
    }
};
export default connectDb;
//# sourceMappingURL=db.js.map