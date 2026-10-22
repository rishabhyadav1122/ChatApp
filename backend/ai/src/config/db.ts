import mongoose from 'mongoose';



const connectDb = async () => {
    const url = process.env.MONGO_URI;
    if (!url) {
        throw new Error("MONGO_URI is not defined in environment variables");
    }

    try {
        await mongoose.connect(url, {
            dbName: "ChatApp"
        });
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        throw error;
    }
};

export default connectDb;
