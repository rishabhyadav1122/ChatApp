<<<<<<< HEAD
# 💬 ChatApp

A **production-grade, microservices-based real-time chat application** built with **Next.js, Node.js, Socket.IO, RabbitMQ, Redis, MongoDB, and Cloudinary**.

The application supports passwordless OTP authentication, real-time messaging, online/offline presence, typing indicators, image sharing, and asynchronous email delivery.

🌐 Live Demo
[BuddyTalk](http://3.7.127.214:3000/)

## ✨ Features

* 🔐 Passwordless OTP authentication
* 💬 Real-time messaging with Socket.IO
* 🟢 Online/offline presence
* ⌨️ Real-time typing indicators
* 🖼️ Image sharing with Cloudinary
* 📧 Asynchronous email delivery with RabbitMQ
* 🔑 JWT-based authentication
* 🗄️ Persistent chat history
* ⚡ Redis for temporary data and presence
* 🐳 Dockerized services
* ☁️ AWS EC2 deployment
* ⚙️ PM2 process management

## 🏗️ Architecture

```text
                         ┌─────────────────┐
                         │    Next.js      │
                         │    Frontend     │
                         └────────┬────────┘
                                  │
                           HTTP / Socket.IO
                                  │
                    ┌─────────────▼─────────────┐
                    │       Chat Service        │
                    │     Node.js + Socket.IO   │
                    └──────────┬───────┬────────┘
                               │       │
                         ┌─────▼───┐ ┌─▼─────────┐
                         │ MongoDB │ │   Redis   │
                         │  Chats  │ │ Presence  │
                         └─────────┘ └───────────┘

       ┌──────────────┐
       │ User Service │
       └──────┬───────┘
              │
              │ OTP Event
              ▼
        ┌─────────────┐
        │  RabbitMQ   │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ Mail Service│
        └──────┬──────┘
               │
               ▼
             SMTP
```

## 🔄 Real-Time Message Flow

```text
User
  │
  ▼
Next.js
  │
  │ Socket.IO
  ▼
Chat Service
  │
  ├──► MongoDB
  │     Store Message
  │
  └──► Socket.IO Room
            │
            ▼
         Receiver
```

## 🧩 Microservices

### User Service

Handles:

* User authentication
* OTP generation & verification
* JWT generation
* User management

### Chat Service

Handles:

* Real-time messaging
* Socket.IO connections
* Chat rooms
* Presence
* Typing indicators
* Message persistence

### Mail Service

Handles:

* OTP emails
* Asynchronous email processing through RabbitMQ
* SMTP communication

## 🛠️ Tech Stack

| Category               | Technology          |
| ---------------------- | ------------------- |
| Frontend               | Next.js             |
| Backend                | Node.js, Express.js |
| Real-Time              | Socket.IO           |
| Database               | MongoDB             |
| Cache / Temporary Data | Redis               |
| Message Broker         | RabbitMQ            |
| Authentication         | JWT, OTP            |
| Media Storage          | Cloudinary          |
| Containerization       | Docker              |
| Process Manager        | PM2                 |
| Deployment             | AWS EC2             |

## 🐳 Running Locally

### Prerequisites

* Node.js
* Docker & Docker Compose
* MongoDB
* Redis
* RabbitMQ
* Cloudinary account
* SMTP credentials

### Clone

```bash
git clone https://github.com/rishabhyadav1122/ChatApp.git
cd ChatApp
```

### Environment Variables

Create the required `.env` files for each service.

```env
MONGO_URI=
REDIS_URL=
RABBITMQ_URL=
JWT_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Run with Docker

```bash
docker compose build
docker compose up -d
```

Check containers:

```bash
docker ps
```

View logs:

```bash
docker compose logs -f
```

Stop services:

```bash
docker compose down
```

## ☁️ Deployment

The application was deployed on **AWS EC2** with Docker and PM2.

* Each service runs in its own Docker container.
* PM2 manages application processes and logs.
* Elastic IP provides a stable server address.
* SSH keys are used for secure deployment and Git access.

### Production Considerations

For larger-scale deployment, the architecture can be extended with:

* AWS Elastic Load Balancer
* Auto Scaling
* Amazon ECR
* ECS/Fargate or EKS
* CDN-based frontend delivery
* Redis Pub/Sub for horizontally scaled Socket.IO instances

## 🔧 Production Challenges

During deployment, I worked through several real-world issues including:

* EC2 Elastic IP configuration
* RabbitMQ service connectivity
* SMTP authentication/security
* Next.js build memory limitations
* Docker container inspection and debugging
* Node.js process management with PM2

## 📌 Future Improvements

* Group chats
* Message read receipts
* Message delivery status
* Message reactions
* Push notifications
* Redis Pub/Sub for horizontal scaling
* RabbitMQ retry & dead-letter queues
* CI/CD pipeline
* Centralized logging & monitoring
* Load balancing and auto-scaling

## 👨‍💻 Author

**Rishabh Yadav**

B.Tech CSE — IIIT Ranchi

[GitHub](https://github.com/rishabhyadav1122) • [LinkedIn](https://www.linkedin.com/in/rishabh-yadav-40a288289/)
=======
# ChatApp

ChatApp is a Next.js messaging frontend with separate user, chat, mail, and AI services.

## Local development

### Frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Adjust the user and chat service URLs if those services run somewhere other than ports 5000 and 5002.
3. Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

### AI service

The AI service uses MongoDB for conversation history and the same JWT signing secret as the user service. Create `backend/ai/.env` from `backend/ai/.env.example`, then set:

- `MONGO_URI`: the MongoDB connection string for the ChatApp database.
- `JWT_SECRET`: the same secret used to sign login tokens in the user service.
- `AI_PROVIDER=groq`, `GROQ_API_KEY`, and `AI_MODEL` for Groq.
- `PORT`: the local port configured by `NEXT_PUBLIC_AI_SERVICE_URL` in the frontend.

Start it with:

```powershell
cd backend/ai
npm install
npm run build
npm test
npm start
```

The service exposes `GET /health` and authenticated routes under `/api/v1/ai`.

### User and chat services

The frontend requires the user service for sign-in and the chat service for normal conversations. Start both using their own environment configuration before signing in. The AI feature shares the user service's JWT secret and uses the AI service's MongoDB configuration.

## AI features

- The message assistant can correct grammar, change tone, and translate a draft. Generated text is previewed and editable; only **Apply** changes the composer draft. It never sends a message.
- The separate AI Assistant creates named, owner-scoped conversations, stores message history, supports retrying the latest answer, and can stop a pending generation.
- AI conversations are stored separately from person-to-person chats.
>>>>>>> 6b9e3ed (Add AI feature)
