import listState from '@/store/list/state'
import { getListMusics } from '@/utils/listManage'
import { similar } from '@/utils/common'
import { type Source } from '@/store/search/music/state'

// Type for local search results
export interface LocalMusicSearchResult {
  list: LX.Music.MusicInfo[]
  limit: number
  total: number
  source: 'local'
}

export interface LocalSonglistSearchResult {
  list: Array<{ 
    id: string
    name: string
    author: string
    source: 'local'
    // Add playlist reference for local playlists
    playlistId?: string
  }>
  limit: number
  total: number
  source: 'local'
}

/**
 * Search local playlists by name
 * @param text Search keyword
 * @param page Page number (currently unused for local search)
 * @param limit Number of results per page
 * @returns Search results containing playlist matches
 */
export const searchSonglists = async(text: string, page: number, limit: number): Promise<LocalSonglistSearchResult> => {
  if (!text.trim()) {
    return {
      list: [],
      limit,
      total: 0,
      source: 'local',
    }
  }

  // Search through all playlists
  const allPlaylists = listState.allList
  
  // Filter and score playlists by similarity to search text
  const scoredPlaylists = allPlaylists.map(playlist => ({
    playlist,
    score: similar(text.toLowerCase(), playlist.name.toLowerCase()),
  })).filter(item => item.score > 0.1) // Minimum similarity threshold
  
  // Sort by score (higher is better)
  scoredPlaylists.sort((a, b) => b.score - a.score)
  
  // Take only the requested limit
  const paginatedResults = scoredPlaylists.slice(0, limit)
  
  const results = paginatedResults.map(item => ({
    id: `local_playlist_${item.playlist.id}`, // Unique ID for local playlists
    name: item.playlist.name,
    author: '本地', // Local
    source: 'local' as const,
    playlistId: item.playlist.id, // Reference to actual playlist ID
  }))

  return {
    list: results,
    limit,
    total: scoredPlaylists.length,
    source: 'local',
  }
}

/**
 * Search local music across all playlists
 * @param text Search keyword
 * @param page Page number (currently unused for local search)
 * @param limit Number of results per page
 * @returns Search results containing music matches
 */
export const searchMusic = async(text: string, page: number, limit: number): Promise<LocalMusicSearchResult> => {
  if (!text.trim()) {
    return {
      list: [],
      limit,
      total: 0,
      source: 'local',
    }
  }

  // Get all music from all playlists
  const allMusicPromises = listState.allList.map(async(playlist) => {
    try {
      const musicList = await getListMusics(playlist.id)
      return musicList.map(music => ({
        music,
        playlistName: playlist.name,
      }))
    } catch (error) {
      console.warn(`Failed to get music from playlist ${playlist.id}:`, error)
      return []
    }
  })

  const allMusicWithPlaylists = (await Promise.all(allMusicPromises)).flat()
  
  // Score each music item based on similarity to search text
  const scoredMusic = allMusicWithPlaylists.map(item => {
    const music = item.music
    // Search in name, singer, and playlist name
    const nameScore = similar(text.toLowerCase(), music.name.toLowerCase())
    const singerScore = music.singer ? similar(text.toLowerCase(), music.singer.toLowerCase()) : 0
    const playlistScore = similar(text.toLowerCase(), item.playlistName.toLowerCase())
    
    // Use the highest score among all fields
    const maxScore = Math.max(nameScore, singerScore, playlistScore)
    
    return {
      music,
      score: maxScore,
    }
  }).filter(item => item.score > 0.1) // Minimum similarity threshold
  
  // Sort by score (higher is better)
  scoredMusic.sort((a, b) => b.score - a.score)
  
  // Take only the requested limit
  const paginatedResults = scoredMusic.slice(0, limit)
  
  const results = paginatedResults.map(item => item.music)

  return {
    list: results,
    limit,
    total: scoredMusic.length,
    source: 'local',
  }
}

/**
 * Get local playlist music by playlist ID
 * This function handles the special case where local playlist IDs need to be resolved
 * @param playlistId The playlist ID (could be the special local_playlist_* format)
 * @returns Promise resolving to array of music infos
 */
export const getLocalPlaylistMusic = async(playlistId: string): Promise<LX.Music.MusicInfo[]> => {
  // Handle the special local playlist ID format
  if (playlistId.startsWith('local_playlist_')) {
    const actualPlaylistId = playlistId.replace('local_playlist_', '')
    return getListMusics(actualPlaylistId)
  }
  
  // Handle regular playlist IDs
  return getListMusics(playlistId)
}