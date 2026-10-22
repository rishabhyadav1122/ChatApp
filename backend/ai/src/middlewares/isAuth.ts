import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

interface IUser {
  _id: string;
  name: string;
  email: string;
}

export interface AuthenticatedRequest extends Request<any, any, any> {
  user?: IUser | null;
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Please Login - No auth header",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    const decodedValue = jwt.verify(
      token as string,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (!decodedValue || !decodedValue.user) {
      res.status(401).json({
        message: "Invalid token",
      });
      return;
    }

    // Check token expiration
    if (decodedValue.exp && Date.now() >= decodedValue.exp * 1000) {
      res.status(401).json({
        message: "Token expired",
      });
      return;
    }

    req.user = decodedValue.user;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Please Login - Invalid token",
    });
  }
};
