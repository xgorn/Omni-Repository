import { NextResponse } from 'next/server';
import { getCollection } from '../../../lib/mongodb';

function isAuthorized(request) {
  const incomingApiKey = request.headers.get('x-api-key');
  const serverApiKey = process.env.API_SECRET_KEY;
  if (!serverApiKey) return false; 
  return incomingApiKey === serverApiKey;
}

// 1. GET: Retrieve entries (With Search and Type Filtering)
export async function GET(request) {
  try {
    const collection = await getCollection();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const typeFilter = searchParams.get('type'); // 👈 Captures public type filtering parameters

    let query = {};
    
    // Build type filter sub-clause
    if (typeFilter && typeFilter !== 'all') {
      query.type = typeFilter.toLowerCase();
    }

    // Build keyword search sub-clause
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { alternative_titles: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const mediaList = await collection.find(query).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(mediaList, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST: Save a new entry (With Type Verification)
export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing API key.' }, { status: 401 });
  }

  try {
    const collection = await getCollection();
    const { title, alternative_titles, last_read_chapter, type } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Standardize types (Default to 'novel')
    const validTypes = ['novel', 'manga', 'manhua', 'manhwa', 'anime'];
    const assignedType = validTypes.includes(type?.toLowerCase()) ? type.toLowerCase() : 'novel';

    const altTitlesArray = Array.isArray(alternative_titles) ? alternative_titles : [];

    const existingMedia = await collection.findOne({
      type: assignedType, // Matches duplication ONLY within the same media format category
      $or: [
        { title: { $regex: `^${title.trim()}$`, $options: 'i' } },
        { alternative_titles: { $regex: `^${title.trim()}$`, $options: 'i' } },
        ...(altTitlesArray.length > 0 ? [
          { title: { $in: altTitlesArray.map(t => new RegExp(`^${t}$`, 'i')) } },
          { alternative_titles: { $in: altTitlesArray.map(t => new RegExp(`^${t}$`, 'i')) } }
        ] : [])
      ]
    });

    if (existingMedia) {
      return NextResponse.json({ 
        error: `Conflict: This title or alternative title already exists in the ${assignedType} catalog.` 
      }, { status: 400 });
    }

    const newMedia = {
      title: title.trim(),
      alternative_titles: altTitlesArray,
      last_read_chapter: Number(last_read_chapter) || 0,
      type: assignedType, // 👈 Saved directly to database
      createdAt: new Date()
    };

    const result = await collection.insertOne(newMedia);
    return NextResponse.json({ message: 'Saved successfully!', id: result.insertedId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. PATCH: Update existing media fields
export async function PATCH(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing API key.' }, { status: 401 });
  }

  try {
    const collection = await getCollection();
    const { original_title, title, alternative_titles, last_read_chapter, type } = await request.json();

    if (!original_title) {
      return NextResponse.json({ error: 'original_title is required' }, { status: 400 });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (last_read_chapter !== undefined) updateData.last_read_chapter = Number(last_read_chapter);
    if (alternative_titles !== undefined) updateData.alternative_titles = alternative_titles;
    
    if (type !== undefined) {
      const validTypes = ['novel', 'manga', 'manhua', 'manhwa', 'anime'];
      if (validTypes.includes(type?.toLowerCase())) updateData.type = type.toLowerCase();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
    }

    const result = await collection.updateOne(
      { title: { $regex: `^${original_title.trim()}$`, $options: 'i' } },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Updated successfully!' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}