# Aden Generator Ebook AI - Vercel Deployment Guide

This project is optimized for deployment on [Vercel](https://vercel.com).

## Prerequisites

1. A [Vercel](https://vercel.com) account.
2. A [Google AI Studio API Key](https://aistudio.google.com/app/apikey).

## Deployment Steps

### 1. Push to GitHub/GitLab/Bitbucket
Ensure your code is in a Git repository.

### 2. Import to Vercel
1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New** > **Project**.
3. Import your repository.

### 3. Configure Environment Variables
In the **Environment Variables** section of the Vercel project settings, add the following:

- `GEMINI_API_KEY`: Your Google AI Studio API Key.

### 4. Build Settings
Vercel should automatically detect the Vite configuration:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 5. Deploy
Click **Deploy**. Vercel will build your app and provide a production URL.

## Local Development
To run the project locally:
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file and add `GEMINI_API_KEY=your_key_here`.
4. Run `npm run dev`.
