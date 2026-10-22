import mongoose, { Schema, Document } from "mongoose";

export interface IAIChat extends Document {
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIChatSchema = new Schema<IAIChat>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AIChatSchema.index({ userId: 1, updatedAt: -1 });

export const AIChat = mongoose.model<IAIChat>("AIChat", AIChatSchema);