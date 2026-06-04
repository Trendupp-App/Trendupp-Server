# Trendupp Backend - Social Commerce Infrastructure

## 🚀 Overview
Trendupp is a high-stakes, event-driven platform designed for creator-brand interactions, social media campaign tracking, and secure financial transactions (Escrow). This repository contains the core NestJS backend services.

## 🏗️ Architecture
The system follows a **Clean Architecture (DDD-inspired)** approach to decouple business logic from external infrastructure.

### Core Stack
- **Framework**: [NestJS](https://nestjs.com/) (Enterprise Node.js)
- **Language**: TypeScript
- **ORM**: [Sequelize](https://sequelize.org/) (PostgreSQL)
- **Task Queue**: [BullMQ](https://docs.bullmq.io/) (Redis) for background jobs & escrow timers
- **Logging**: Winston + [BetterStack](https://betterstack.com/) (Logtail)
- **Validation**: Joi (Environment) & Class-Validator (DTOs)
- **Documentation**: Swagger/OpenAPI

## 📂 Project Structure
```text
src/
├── common/                # Shared utilities, filters, decorators, logger
├── config/                # Environment configuration & Joi validation
├── core/                  # Core abstractions (Base service, Base entity)
├── domains/               # Domain-driven feature modules
│   ├── accounts/          # User, RBAC, Profiles
│   ├── campaigns/         # Campaign briefs, discovery
│   ├── applications/      # Creator-Brand interaction
│   ├── billing/           # Escrow, Wallets, Payments
│   └── ...
├── infrastructure/        # Third-party adapters (AWS S3, Social APIs)
└── database/              # Migrations, Seeders, Models
```

## 🛠️ Key Systems
- **Escrow Pipeline**: Secured using PostgreSQL ACID transactions.
- **Social Metric Scraping**: Asynchronous validation of TikTok/Meta metrics via BullMQ.
- **Media Strategy**: Direct S3 uploads via Presigned URLs to minimize server overhead.

## 🚦 Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL
- Redis (for BullMQ)

### Installation
```bash
npm install
```

### Environment Setup
Copy the `.env.example` to `.env` and fill in your credentials.
```bash
cp .env.example .env
```

### Running Locally
```bash
# Development
npm run start:dev

# Production build
npm run build
```

### API Documentation
Once the server is running, visit:
`http://localhost:3000/docs`

## 🧪 Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

---
**Trendupp Engineering** | Robust, Scalable, Secure.
