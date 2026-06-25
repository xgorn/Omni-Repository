import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const incomingApiKey = request.headers.get('x-api-key');
    const serverApiKey = process.env.API_SECRET_KEY;

    if (!serverApiKey) {
      return NextResponse.json({ error: 'Server configuration error: Master key not set.' }, { status: 500 });
    }

    // Compare the key sent by the frontend with the hidden cloud variable
    if (incomingApiKey === serverApiKey) {
      return NextResponse.json({ authenticated: true, message: 'Vault unlocked successfully.' }, { status: 200 });
    }

    return NextResponse.json({ authenticated: false, error: 'Invalid API key.' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}