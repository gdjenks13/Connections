# Hosting Connections on GitHub Pages + Supabase

This guide walks you through:
1. Deploying your static site to GitHub Pages
2. Setting up Supabase for puzzle storage, user accounts, and analytics
3. Updating your `connections.html` code to use Supabase

---

## Part 1 — Deploy to GitHub Pages

**Steps:**

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new repository (e.g. `connections-game`). Make it **Public**.
3. Upload your `connections.html` file and rename it to `index.html`.
4. Go to your repo → **Settings** → **Pages** → set Source to `main` branch, `/ (root)`.
5. Your site will be live at: `https://your-username.github.io/connections-game/`

**Custom domain (optional):** In Settings → Pages you can add a custom domain like `connections.yourdomain.com` for free. You'll just need to add a CNAME record with your DNS provider.

---

## Part 2 — Set Up Supabase

### 2a. Create your project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New Project**. Name it `connections`. Choose a region close to your users.
3. Set a strong database password and save it somewhere safe.
4. Wait ~2 minutes for the project to initialize.

### 2b. Create your database tables

In your Supabase dashboard, go to **SQL Editor** and run the following:

```sql
-- Stores each puzzle a user creates
CREATE TABLE puzzles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT,
  categories JSONB NOT NULL,
  max_mistakes INT DEFAULT 4,
  play_count INT DEFAULT 0
);

-- Stores each game attempt (for analytics)
CREATE TABLE game_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  puzzle_id UUID REFERENCES puzzles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'start', 'guess_correct', 'guess_wrong', 'win', 'lose'
  metadata JSONB           -- e.g. { "category": "Types of Fish", "mistakes_used": 2 }
);

-- Enable Row Level Security
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read puzzles (needed to share links)
CREATE POLICY "Public read puzzles"
  ON puzzles FOR SELECT USING (true);

-- Only the creator can insert their own puzzle
CREATE POLICY "Authenticated insert puzzles"
  ON puzzles FOR INSERT
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Anyone can insert game events (anonymous play allowed)
CREATE POLICY "Public insert game events"
  ON game_events FOR INSERT WITH CHECK (true);

-- Users can only read their own events
CREATE POLICY "Users read own events"
  ON game_events FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);
```

### 2c. Enable Authentication

1. In Supabase dashboard → **Authentication** → **Providers**
2. Enable **Email** (simplest). Optionally enable **Google** or **GitHub** OAuth for social login.
3. Under **Auth** → **URL Configuration**, set your Site URL to your GitHub Pages URL:
   `https://your-username.github.io/connections-game`

### 2d. Get your API keys

In Supabase dashboard → **Settings** → **API**:
- Copy your **Project URL** (looks like `https://abcxyz.supabase.co`)
- Copy your **anon / public key** (safe to use in frontend code)

---

## Part 3 — Update Your Code

Replace the top of your `<script>` section (before `init()`) with the following additions. The Supabase JS client is loaded via CDN.

### 3a. Add to `<head>` — load Supabase SDK

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 3b. Add Supabase config at the top of your `<script>` block

```js
// ===================== SUPABASE =====================
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';  // ← replace
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';                   // ← replace

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Track current user (null if not logged in)
let currentUser = null;
sb.auth.getUser().then(({ data }) => { currentUser = data?.user ?? null; });
sb.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();
});
```

### 3c. Replace `puzzleToURL` with a Supabase-backed version

Remove the old `puzzleToURL` and `puzzleFromURL` functions and replace them with:

```js
// Save puzzle to Supabase, return short URL using the UUID
async function savePuzzle(puzzleData) {
  const { data, error } = await sb.from('puzzles').insert({
    created_by: currentUser?.id ?? null,
    title: puzzleData.title ?? null,
    categories: puzzleData.categories,
    max_mistakes: puzzleData.maxMistakes ?? 4
  }).select('id').single();

  if (error) throw error;
  return `${location.origin}${location.pathname}?id=${data.id}`;
}

// Load puzzle from Supabase by UUID
async function loadPuzzleById(id) {
  const { data, error } = await sb.from('puzzles').select('*').eq('id', id).single();
  if (error) throw error;

  // Increment play count (fire and forget)
  sb.from('puzzles').update({ play_count: data.play_count + 1 }).eq('id', id);

  return {
    categories: data.categories,
    maxMistakes: data.max_mistakes
  };
}

// Updated init: check for ?id= first, fall back to ?p= (legacy base64), then default
async function init() {
  loadHints();
  const params = new URLSearchParams(location.search);

  if (params.get('id')) {
    try {
      puzzle = await loadPuzzleById(params.get('id'));
    } catch(e) {
      showToast('Could not load puzzle.');
      puzzle = DEFAULT_PUZZLE;
    }
  } else if (params.get('p')) {
    // Legacy base64 support
    try {
      const json = atob(params.get('p').replace(/-/g,'+').replace(/_/g,'/'));
      puzzle = JSON.parse(json);
    } catch { puzzle = DEFAULT_PUZZLE; }
  } else {
    puzzle = DEFAULT_PUZZLE;
  }

  trackEvent('start');
  showScreen('game');
  buildGame();
}
```

### 3d. Update the Generate Link button handler

Replace the `generate-btn` click handler's last few lines:

```js
document.getElementById('generate-btn').addEventListener('click', async () => {
  // ... (keep your existing validation code above) ...

  const newPuzzle = { categories, maxMistakes: parseInt(mistakeSlider.value) };

  // Show loading state
  document.getElementById('generate-btn').textContent = 'Saving...';
  document.getElementById('generate-btn').disabled = true;

  try {
    const url = await savePuzzle(newPuzzle);
    document.getElementById('share-url').value = url;
    document.getElementById('share-result').classList.add('visible');
    document.getElementById('share-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch(e) {
    showToast('Error saving puzzle. Check your connection.');
  } finally {
    document.getElementById('generate-btn').textContent = 'Generate Link';
    document.getElementById('generate-btn').disabled = false;
  }
});
```

### 3e. Add analytics event tracking

Add this helper function and call it at key moments:

```js
async function trackEvent(type, metadata = {}) {
  await sb.from('game_events').insert({
    puzzle_id: puzzle?._id ?? null,  // store puzzle UUID on the puzzle object if loaded from DB
    user_id: currentUser?.id ?? null,
    event_type: type,
    metadata
  });
}
```

Call it like this in your game logic:
```js
// In handleSubmit, on correct guess:
trackEvent('guess_correct', { category: puzzle.categories[catIdx].name });

// On wrong guess:
trackEvent('guess_wrong', { mistakesRemaining: mistakes });

// In showResultModal:
trackEvent(won ? 'win' : 'lose', { mistakesUsed: total - mistakes });
```

### 3f. Add simple Auth UI (optional but recommended)

Add a **Login** button to your header and this JS:

```js
function updateAuthUI() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  btn.textContent = currentUser ? 'My Puzzles' : 'Sign In';
}

async function handleAuth() {
  if (currentUser) {
    // Show a simple "my puzzles" list — query puzzles by created_by
    const { data } = await sb.from('puzzles')
      .select('id, title, created_at, play_count')
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false });

    // Display them however you like — a modal works well
    console.log('Your puzzles:', data);
  } else {
    // Trigger magic link / email login
    const email = prompt('Enter your email for a magic sign-in link:');
    if (email) {
      await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
      showToast('Check your email for a sign-in link!');
    }
  }
}
```

---

## Part 4 — Viewing Analytics in Supabase

You don't need to build a dashboard right away. Supabase gives you a built-in **Table Editor** and you can run SQL queries directly:

```sql
-- Most played puzzles
SELECT p.id, p.title, p.play_count,
       COUNT(e.id) FILTER (WHERE e.event_type = 'win') AS wins,
       COUNT(e.id) FILTER (WHERE e.event_type = 'lose') AS losses
FROM puzzles p
LEFT JOIN game_events e ON e.puzzle_id = p.id
GROUP BY p.id
ORDER BY p.play_count DESC
LIMIT 20;

-- Win rate over time
SELECT DATE_TRUNC('day', created_at) AS day,
       COUNT(*) FILTER (WHERE event_type = 'win') AS wins,
       COUNT(*) FILTER (WHERE event_type = 'lose') AS losses
FROM game_events
GROUP BY day
ORDER BY day DESC;
```

For a proper dashboard later, consider connecting Supabase to **Metabase** (free, self-hostable) or **Grafana**.

---

## Summary — What You Get

| Feature | How |
|---|---|
| Short shareable links (`?id=uuid`) | Supabase `puzzles` table |
| User accounts | Supabase Auth (email magic link or OAuth) |
| "My Puzzles" history | Query `puzzles` by `created_by` |
| Play count per puzzle | `play_count` column, incremented on load |
| Guess/win/loss analytics | `game_events` table |
| Row-level security | Policies prevent users from editing others' puzzles |
| Free tier limits | 500MB DB, 50,000 MAU, 5GB bandwidth — very generous for a hobby project |

---

## Supabase Free Tier Limits (as of 2025)

- **Database:** 500MB storage
- **Auth:** 50,000 monthly active users
- **Bandwidth:** 5GB/month
- **API requests:** Unlimited (rate-limited at 500 req/sec)
- Projects pause after **1 week of inactivity** on the free tier — upgrade to Pro ($25/mo) if you want always-on hosting.
