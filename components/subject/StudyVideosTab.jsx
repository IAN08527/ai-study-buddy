"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import VideoNotes from "./VideoNotes";

// ── Helpers ────────────────────────────────────────────────
const getYouTubeId = (url) => {
  if (!url) return "";
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : "";
};

const getPlaylistId = (url) => {
  if (!url) return "";
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
};

const getThumbnailUrl = (url) => {
  const videoId = getYouTubeId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  return null;
};

const isValidYoutubeUrl = (link) => {
  if (!link) return false;
  return (
    link.startsWith("https://youtu.be/") ||
    link.startsWith("https://www.youtube.com/watch") ||
    link.startsWith("https://youtube.com/watch") ||
    link.startsWith("https://www.youtube.com/playlist") ||
    link.startsWith("https://youtube.com/playlist")
  );
};

// ── Main Component ─────────────────────────────────────────
const StudyVideosTab = ({
  videos,
  selectedVideo,
  onVideoSelect,
  subjectId,
  onVideoAdded,
}) => {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [expandedPlaylists, setExpandedPlaylists] = useState({});
  const [playlistVideos, setPlaylistVideos] = useState({}); // { resourceId: [videos] }
  const [loadingPlaylist, setLoadingPlaylist] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({ title: "", link: "" });
  const [isAdding, setIsAdding] = useState(false);

  // ── Playback State (localStorage) ──────────────────────
  const playbackKey = `video-state-${subjectId}`;

  // Restore last-watched video on mount
  useEffect(() => {
    if (selectedVideo) {
      setCurrentVideo(selectedVideo);
      return;
    }

    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(playbackKey);
      if (stored) {
        const { videoId } = JSON.parse(stored);
        const found = videos.find((v) => v.resource_id === videoId);
        if (found) {
          setCurrentVideo(found);
          return;
        }
      }
    } catch { /* ignore */ }

    // Default to first video
    if (videos.length > 0) {
      setCurrentVideo(videos[0]);
    }
  }, [selectedVideo, videos, playbackKey]);

  // Save playback state when video changes
  useEffect(() => {
    if (currentVideo && subjectId) {
      localStorage.setItem(
        playbackKey,
        JSON.stringify({ videoId: currentVideo.resource_id })
      );
    }
  }, [currentVideo, subjectId, playbackKey]);

  const handleVideoClick = (video) => {
    setCurrentVideo(video);
    onVideoSelect(video);
  };

  // Play a specific video from an expanded playlist
  const handlePlaylistVideoClick = (playlistResource, videoData) => {
    // Create a synthetic "resource" to play this specific playlist video
    const syntheticVideo = {
      ...playlistResource,
      _playlistVideoId: videoData.videoId,
      _playlistVideoTitle: videoData.title,
    };
    setCurrentVideo(syntheticVideo);
  };

  // ── Playlist Expansion via RSS API ─────────────────────
  const togglePlaylist = async (resource) => {
    const resourceId = resource.resource_id;
    const isCurrentlyExpanded = expandedPlaylists[resourceId];

    setExpandedPlaylists((prev) => ({
      ...prev,
      [resourceId]: !isCurrentlyExpanded,
    }));

    // If collapsing or already fetched, no API call needed
    if (isCurrentlyExpanded || playlistVideos[resourceId]) return;

    // Fetch playlist videos from RSS
    const plId = getPlaylistId(resource.link);
    if (!plId) return;

    setLoadingPlaylist(resourceId);
    try {
      const response = await fetch(`/api/getPlaylistVideos/${plId}`);
      if (!response.ok) throw new Error("Failed to load playlist");
      const data = await response.json();
      setPlaylistVideos((prev) => ({
        ...prev,
        [resourceId]: data.videos || [],
      }));
    } catch (error) {
      toast.error("Could not load playlist videos");
      console.error(error);
    } finally {
      setLoadingPlaylist(null);
    }
  };

  // ── Add Video ──────────────────────────────────────────
  const handleAddVideo = async () => {
    if (!addFormData.link.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }
    if (!isValidYoutubeUrl(addFormData.link.trim())) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch("/api/addVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          title: addFormData.title.trim() || undefined,
          link: addFormData.link.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast.success("Video added!");
      setAddFormData({ title: "", link: "" });
      setShowAddForm(false);
      if (onVideoAdded) onVideoAdded();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  // ── Build embed URL ────────────────────────────────────
  const getEmbedUrl = (video) => {
    if (!video) return "";
    const link = video.link;

    // If playing a specific video from an expanded playlist
    if (video._playlistVideoId) {
      const plId = getPlaylistId(link);
      return `https://www.youtube.com/embed/${video._playlistVideoId}?list=${plId}&rel=0&modestbranding=1`;
    }

    // If it's a playlist resource
    if (video.resource_type === "YouTube Playlist" || getPlaylistId(link)) {
      const playlistId = getPlaylistId(link);
      const videoId = getYouTubeId(link);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0&modestbranding=1`;
      }
      return `https://www.youtube.com/embed/videoseries?list=${playlistId}&rel=0&modestbranding=1`;
    }

    // Regular video
    const videoId = getYouTubeId(link);
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  };

  // ── Get display title ──────────────────────────────────
  const getDisplayTitle = (video) => {
    if (!video) return "No video selected";
    if (video._playlistVideoTitle) return video._playlistVideoTitle;
    return video.title;
  };

  // ── Empty State ────────────────────────────────────────
  if (!videos || videos.length === 0) {
    return (
      <div className="videos-tab">
        <div className="videos-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m10 9 5 3-5 3z" />
          </svg>
          <h3>No videos yet</h3>
          <p>Add YouTube videos to your chapters to see them here</p>
          <button
            className="videos-empty-add-btn"
            onClick={() => setShowAddForm(true)}
          >
            + Add First Video
          </button>
        </div>

        {showAddForm && (
          <AddVideoForm
            addFormData={addFormData}
            setAddFormData={setAddFormData}
            isAdding={isAdding}
            onAdd={handleAddVideo}
            onCancel={() => { setShowAddForm(false); setAddFormData({ title: "", link: "" }); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="videos-tab">
      {/* Main player + info */}
      <div className="videos-main">
        <div className="videos-player-wrapper">
          {currentVideo ? (
            <iframe
              className="videos-player"
              src={getEmbedUrl(currentVideo)}
              title={getDisplayTitle(currentVideo)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="videos-player-empty">
              <p>Select a video from the playlist</p>
            </div>
          )}
        </div>
        <div className="videos-info">
          <h3 className="videos-title">{getDisplayTitle(currentVideo)}</h3>
          {(currentVideo?.resource_type === "YouTube Playlist" || getPlaylistId(currentVideo?.link)) && !currentVideo._playlistVideoTitle && (
            <span className="videos-playlist-badge">Playlist</span>
          )}
        </div>

        {/* Video Notes */}
        {currentVideo && (
          <VideoNotes
            resourceId={currentVideo._playlistVideoId || currentVideo.resource_id}
            videoTitle={getDisplayTitle(currentVideo)}
          />
        )}
      </div>

      {/* Playlist sidebar */}
      <div className="videos-playlist">
        <div className="videos-playlist-header">
          <div>
            <h4 className="videos-playlist-title">Playlist</h4>
            <p className="videos-playlist-count">{videos.length} videos</p>
          </div>
          <button
            className="videos-playlist-add"
            aria-label="Add video"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Inline Add Form */}
        {showAddForm && (
          <AddVideoForm
            addFormData={addFormData}
            setAddFormData={setAddFormData}
            isAdding={isAdding}
            onAdd={handleAddVideo}
            onCancel={() => { setShowAddForm(false); setAddFormData({ title: "", link: "" }); }}
            inline
          />
        )}

        {/* Video List */}
        <div className="videos-playlist-list custom-scrollbar">
          {videos.map((video) => {
            const isPlaylist = video.resource_type === "YouTube Playlist" || !!getPlaylistId(video.link);
            const isExpanded = expandedPlaylists[video.resource_id];
            const isActive = currentVideo?.resource_id === video.resource_id;
            const thumbnailUrl = getThumbnailUrl(video.link);
            const plVideos = playlistVideos[video.resource_id] || [];
            const isLoading = loadingPlaylist === video.resource_id;

            if (isPlaylist) {
              return (
                <div key={video.resource_id} className="videos-playlist-group">
                  {/* Collapsed playlist header */}
                  <button
                    className={`videos-playlist-item ${isActive && !currentVideo?._playlistVideoId ? "videos-playlist-item--active" : ""}`}
                    onClick={() => togglePlaylist(video)}
                  >
                    <div className="videos-playlist-thumb">
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="" className="videos-thumb-img" />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m10 9 5 3-5 3z" />
                        </svg>
                      )}
                      <div className="videos-playlist-icon-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </div>
                    </div>
                    <div className="videos-playlist-meta">
                      <span className="videos-playlist-item-title">{video.title}</span>
                      <span className="videos-playlist-item-duration">
                        {isLoading ? "Loading..." : `Playlist · ${plVideos.length > 0 ? `${plVideos.length} videos` : "Click to expand"}`}
                      </span>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`videos-expand-chevron ${isExpanded ? "videos-expand-chevron--open" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Expanded playlist videos */}
                  {isExpanded && (
                    <div className="videos-playlist-expanded">
                      {isLoading && (
                        <div className="videos-playlist-loading">
                          <div className="subject-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                          <span>Loading playlist...</span>
                        </div>
                      )}
                      {plVideos.map((pv, idx) => (
                        <button
                          key={pv.videoId}
                          className={`videos-playlist-item videos-playlist-item--nested ${
                            currentVideo?._playlistVideoId === pv.videoId ? "videos-playlist-item--active" : ""
                          }`}
                          onClick={() => handlePlaylistVideoClick(video, pv)}
                        >
                          <div className="videos-playlist-thumb">
                            <img src={pv.thumbnail} alt="" className="videos-thumb-img" />
                          </div>
                          <div className="videos-playlist-meta">
                            <span className="videos-playlist-item-title">{pv.title}</span>
                            <span className="videos-playlist-item-duration">#{idx + 1}</span>
                          </div>
                        </button>
                      ))}
                      {!isLoading && plVideos.length === 0 && (
                        <p className="videos-playlist-expanded-hint">
                          Could not load individual videos. Use the player controls above.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Regular video item
            return (
              <button
                key={video.resource_id}
                className={`videos-playlist-item ${isActive ? "videos-playlist-item--active" : ""}`}
                onClick={() => handleVideoClick(video)}
              >
                <div className="videos-playlist-thumb">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" className="videos-thumb-img" />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </div>
                <div className="videos-playlist-meta">
                  <span className="videos-playlist-item-title">{video.title}</span>
                  <span className="videos-playlist-item-duration">{video.duration || "—"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Add Video Form Sub-component ─────────────────────────
const AddVideoForm = ({ addFormData, setAddFormData, isAdding, onAdd, onCancel, inline }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAdd();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  const formContent = (
    <div className={`videos-add-form ${inline ? "videos-add-form--inline" : ""}`}>
      <input
        type="text"
        placeholder="Video title (optional)"
        value={addFormData.title}
        onChange={(e) => setAddFormData({ ...addFormData, title: e.target.value })}
        className="videos-add-input"
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <input
        type="text"
        placeholder="https://youtube.com/... or playlist URL"
        value={addFormData.link}
        onChange={(e) => setAddFormData({ ...addFormData, link: e.target.value })}
        className="videos-add-input"
        onKeyDown={handleKeyDown}
      />
      <div className="videos-add-actions">
        <button
          className="videos-add-cancel"
          onClick={onCancel}
          disabled={isAdding}
        >
          Cancel
        </button>
        <button
          className="videos-add-submit"
          onClick={onAdd}
          disabled={isAdding || !addFormData.link.trim()}
        >
          {isAdding ? "Adding..." : "Add Video"}
        </button>
      </div>
    </div>
  );

  if (!inline) {
    return (
      <div className="videos-add-overlay" onClick={onCancel}>
        <div onClick={(e) => e.stopPropagation()}>
          {formContent}
        </div>
      </div>
    );
  }

  return formContent;
};

export default StudyVideosTab;
