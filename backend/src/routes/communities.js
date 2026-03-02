/**
 * Community routes.
 *
 * Security:
 *   - All routes require authentication
 *   - Member lists: only visible to fellow approved members
 *   - Nearby discovery: rate-limited, returns area_name NOT coords
 *   - Admin actions: only community admins can approve/reject
 */

import { Router } from 'express'
import { authenticate } from '../auth/index.js'
import { nearbyRateLimit } from '../middleware/rateLimit.js'
import * as commRepo from '../repositories/communities.js'

export const communityRouter = Router()

// All community routes require authentication
communityRouter.use(authenticate)

/**
 * GET /api/communities — List all communities (public view)
 */
communityRouter.get('/', async (_req, res) => {
  try {
    const communities = await commRepo.listAll()
    res.json({ communities })
  } catch (err) {
    console.error('List communities error:', err.message)
    res.status(500).json({ error: 'Failed to list communities' })
  }
})

/**
 * GET /api/communities/nearby?lat=&lng= — Discover nearby communities
 */
communityRouter.get('/nearby', nearbyRateLimit, async (req, res) => {
  const { lat, lng } = req.query

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const latitude = parseFloat(lat)
  const longitude = parseFloat(lng)

  if (isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ error: 'lat and lng must be numbers' })
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'lat/lng out of range' })
  }

  try {
    const communities = await commRepo.findNearby(latitude, longitude)
    res.json({ communities })
  } catch (err) {
    console.error('Nearby discovery error:', err.message)
    res.status(500).json({ error: 'Failed to discover nearby communities' })
  }
})

/**
 * GET /api/communities/:id — Community detail
 */
communityRouter.get('/:id', async (req, res) => {
  try {
    const community = await commRepo.findById(req.params.id)
    if (!community) {
      return res.status(404).json({ error: 'Community not found' })
    }
    res.json({ community })
  } catch (err) {
    console.error('Community detail error:', err.message)
    res.status(500).json({ error: 'Failed to get community' })
  }
})

/**
 * POST /api/communities — Create a community
 */
communityRouter.post('/', async (req, res) => {
  const { name, description, latitude, longitude, areaName } = req.body

  if (!name || !latitude || !longitude) {
    return res.status(400).json({ error: 'name, latitude, and longitude are required' })
  }

  try {
    const community = await commRepo.create({
      name,
      description,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      areaName,
      createdBy: req.user.userId,
    })
    res.status(201).json({ community })
  } catch (err) {
    console.error('Create community error:', err.message)
    res.status(500).json({ error: 'Failed to create community' })
  }
})

/**
 * POST /api/communities/:id/request-join — Request to join
 */
communityRouter.post('/:id/request-join', async (req, res) => {
  try {
    const result = await commRepo.requestJoin(req.params.id, req.user.userId)
    if (!result) {
      return res.status(409).json({ error: 'Already a member or request pending' })
    }
    res.json({ status: 'pending' })
  } catch (err) {
    console.error('Join request error:', err.message)
    res.status(500).json({ error: 'Failed to request join' })
  }
})

/**
 * POST /api/communities/:id/leave — Leave a community
 */
communityRouter.post('/:id/leave', async (req, res) => {
  try {
    const success = await commRepo.leave(req.params.id, req.user.userId)
    if (!success) {
      return res.status(404).json({ error: 'Not a member' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Leave community error:', err.message)
    res.status(500).json({ error: 'Failed to leave community' })
  }
})

/**
 * GET /api/communities/:id/members — Full member list (members only)
 */
communityRouter.get('/:id/members', async (req, res) => {
  try {
    const memberCheck = await commRepo.isMember(req.params.id, req.user.userId)
    if (!memberCheck) {
      return res.status(403).json({ error: 'Only members can view the member list' })
    }

    const members = await commRepo.getMembers(req.params.id)
    res.json({ members })
  } catch (err) {
    console.error('Get members error:', err.message)
    res.status(500).json({ error: 'Failed to get members' })
  }
})

/**
 * GET /api/communities/:id/pending — Pending join requests (admin only)
 */
communityRouter.get('/:id/pending', async (req, res) => {
  try {
    const adminCheck = await commRepo.isAdmin(req.params.id, req.user.userId)
    if (!adminCheck) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const pending = await commRepo.getPendingRequests(req.params.id)
    res.json({ pending })
  } catch (err) {
    console.error('Get pending error:', err.message)
    res.status(500).json({ error: 'Failed to get pending requests' })
  }
})

/**
 * POST /api/communities/:id/approve/:uid — Approve a pending member (admin only)
 */
communityRouter.post('/:id/approve/:uid', async (req, res) => {
  try {
    const adminCheck = await commRepo.isAdmin(req.params.id, req.user.userId)
    if (!adminCheck) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const success = await commRepo.approveMember(req.params.id, req.params.uid)
    if (!success) {
      return res.status(404).json({ error: 'No pending request found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Approve member error:', err.message)
    res.status(500).json({ error: 'Failed to approve member' })
  }
})

/**
 * POST /api/communities/:id/reject/:uid — Reject a pending member (admin only)
 */
communityRouter.post('/:id/reject/:uid', async (req, res) => {
  try {
    const adminCheck = await commRepo.isAdmin(req.params.id, req.user.userId)
    if (!adminCheck) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const success = await commRepo.rejectMember(req.params.id, req.params.uid)
    if (!success) {
      return res.status(404).json({ error: 'No pending request found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Reject member error:', err.message)
    res.status(500).json({ error: 'Failed to reject member' })
  }
})
