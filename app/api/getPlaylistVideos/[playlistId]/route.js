import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    const { playlistId } = await params;

    if (!playlistId) {
      return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 });
    }

    // Fetch the YouTube RSS feed for this playlist
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 502 });
    }

    const xml = await response.text();

    // Parse the XML to extract video entries
    // Each entry has <yt:videoId>, <title>, and <media:thumbnail>
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];

      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);

      if (videoIdMatch) {
        videos.push({
          videoId: videoIdMatch[1],
          title: titleMatch ? titleMatch[1] : "Untitled",
          thumbnail: `https://img.youtube.com/vi/${videoIdMatch[1]}/mqdefault.jpg`,
        });
      }
    }

    // Also get the playlist title
    const playlistTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const playlistTitle = playlistTitleMatch ? playlistTitleMatch[1] : "Playlist";

    return NextResponse.json({
      playlistTitle,
      videos,
      total: videos.length,
    });

  } catch (error) {
    console.error("Playlist Fetch Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
