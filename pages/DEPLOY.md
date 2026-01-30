# Deploying to Codeberg Pages

To publish these pages to Codeberg Pages, you need to push the contents of this folder (`public_pages`) to a branch named `pages` in your repository.

## Method 1: Using git subtree (Recommended)

1. Commit the `public_pages` folder to your main branch first.
   ```bash
   git add public_pages
   git commit -m "Add public facing website"
   ```

2. Push the subtree to the `pages` branch:
   ```bash
   git subtree push --prefix public_pages origin pages
   ```

## Method 2: Manual Branch Creation

1. Create an orphan branch (empty branch):
   ```bash
   git checkout --orphan pages
   git reset --hard
   ```

2. Copy the contents of `public_pages` to the root of the repository.

3. Commit and push:
   ```bash
   git add .
   git commit -m "Deploy website"
   git push origin pages
   ```

4. Switch back to your main branch:
   ```bash
   git checkout main
   ```

Once pushed, your site should be available at: `https://{username}.codeberg.page/Tillsammans/`
