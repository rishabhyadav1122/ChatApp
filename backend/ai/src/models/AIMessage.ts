import mongoose, { Schema, Document } from "mongoose";

export interface IAIMessage extends Document {
  chatId: string;
  sender: string;
  text: string;
  createdAt: Date;
}

const AIMessageSchema = new Schema<IAIMessage>({
  chatId: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

AIMessageSchema.index({ chatId: 1, createdAt: 1 });

export const AIMessage = mongoose.model<IAIMessage>("AIMessage", AIMessageSchema);