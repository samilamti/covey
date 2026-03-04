---
title: Glossary
pageId: glossary
order: 5
layout: layouts/page.njk
description: Explanation of key terms used in Covey.
---

## Core concepts

### Assistance request

A time-limited request for real-world safety support -- for example "I need someone to walk home with." Created by a **requester** and carried out by a **helper**. Can be **freestanding** (without a community) or **community-scoped**.

### Requester

The person who creates an assistance request. They are seeking safety support, such as a walking companion.

### Helper

The person who accepts and carries out an assistance request. Must meet eligibility requirements before approval. During an active session, both parties share their location in real time.

### Session

The active phase of an assistance request, from acceptance to completion. During a session, the requester and helper can exchange messages and share their location.

### Community

A group of users with a shared context, such as a residential area, a workplace or a university. Communities use approved memberships and pseudonymous display names.

### Freestanding request

An assistance request created without a community. Visible to all verified users.

## Eligibility and safety

### Eligibility tier

Controls who can see and accept a request. Three tiers are available:

| Tier | Rule | Description |
|------|------|-------------|
| **Similar to me** | Same sex AND birth year within 5 years | Default. Matches people of similar age and sex. |
| **Verified guardians** | Demographic match OR safety score of 5 or above | Opens up to experienced helpers. |
| **All members** | No restrictions | All verified users can accept. |

### Safety score

An accumulated score based on reviews after completed sessions. New users start at 0. A score of 5 or above qualifies as a **verified guardian**.

### Verified guardian

A user whose safety score reaches the threshold (currently 5). Can accept requests at the "Verified guardians" tier even without a demographic match.

## Identity and authentication

### BankID

Sweden's national electronic identification system. Used for secure login in Covey.

### National Identity Number (NIN)

A Swedish personal identity number in the format YYYYMMDDXXXX. Used for BankID verification. **Never stored in plain text** -- only as a cryptographic hash.

## Location and geography

### Real-time location sharing

Sharing of position between requester and helper during an active session. Rate-limited to one update every five seconds. All location data is deleted when the session ends.

### Estimated Time of Arrival (ETA)

Calculation of approximate time until the parties meet, based on straight-line distance with an assumed walking speed (5 km/h).

## Request lifecycle

An assistance request passes through the following statuses:

| Status | Meaning |
|--------|---------|
| **Open** | Waiting for a helper. Visible in listings based on eligibility. |
| **Accepted** | Helper assigned. Messaging enabled. |
| **Active** | Session in progress. Location sharing active. |
| **Done pending** | One party has marked the session as done; waiting for confirmation. |
| **Completed** | Session finished. Awaiting safety confirmation. |
| **Safety confirmed** | The requester has confirmed safe arrival. |
| **Cancelled** | Cancelled by either party. |
| **Expired** | Automatically expired (30-minute timeout). |
