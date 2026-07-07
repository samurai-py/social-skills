---
name: brand-voice
argument-hint: "[optional: brand-id, default: generic]"
description: >
  Use to create or update a brand's global editorial voice profile.
  Triggers: "brand interview", "define brand voice", "create brand profile",
  "brand voice", "how does the brand write", "brand tone".
  Should run before writing content for a specific brand or channel.
---

# Brand Voice — Unified Brand Interview

Run a structured interview with the user to capture the brand's identity, editorial pillars, stances, and values. The profile will be saved inside the target brand's directory.

---

## Instructions

1. **Identify the Brand and Industry**:
   - Ask the user which brand they are profiling (e.g., `katana`, `4gentes`, or a new generic brand).
   - Ask which industry or vertical it belongs to (e.g., **Fashion/Lifestyle**, **B2B SaaS/Tech**, **Science/Education**, or **Generic**).

2. **Tailor the Questions**:
   Ask the following 7 questions one by one, adapting them to the identified industry:

   ### 🅰️ B2B SaaS / Tech
   1. Brand name and what it solves in one sentence?
   2. Who is the ideal customer (role, industry, main pain point)?
   3. 3 adjectives that describe the brand's tone (e.g., authoritative, clear, tech-savvy)?
   4. Stances/opinions: What does the brand advocate for (e.g., open source, automation) and what does it object to?
   5. Style reference: A tech brand/creator you admire and why?
   6. What is the biggest technical objection customers have?
   7. Customer transformation: How does their work change after adoption?

   ### 🅱️ Fashion / Lifestyle
   1. Brand name and price range/style category (e.g., streetwear, luxury)?
   2. Sub-brands: Is there a sub-brand? If so, what is its separate aesthetic/audience?
   3. Who is the ideal customer and what do they want to express by wearing the brand?
   4. 3 adjectives that define the brand's attitude (e.g., minimal, bold, irreverent)?
   5. Visual mood: References for photography, lookbooks, or cultural moodboards?
   6. Style reference: Brands or style icons you admire?
   7. Customer feeling: What transformation or sensory feeling do they get wearing it?

   ### 🅲 Science / Education
   1. Brand name and educational/research focus in one sentence?
   2. Who is the target reader (students, peers, general public, investors)?
   3. 3 adjectives describing the educational tone (e.g., didactic, precise, intellectually curious)?
   4. Stances/opinions: What scientific/editorial lines or arguments does it advocate?
   5. Style reference: A scientific communicator or publication you admire?
   6. What is the main myth/misconception in this field?
   7. Reader transformation: What knowledge or clarity do they gain?

   ### 🅳 Generic / Other
   1. Brand name and core offer in one sentence?
   2. Who is the ideal customer?
   3. 3 adjectives for the tone?
   4. What would the brand **never** say or do?
   5. Style references admired?
   6. Main customer objection or doubt?
   7. Customer transformation?

3. **Synthesize the Profile**:
   Assemble the answers into a unified JSON schema:

   ```json
   {
     "brand_name": "",
     "industry": "",
     "offer": "",
     "sub_brands": [],
     "ideal_customer": {
       "profile": "",
       "pain_points": [],
       "aspirations": []
     },
     "tone_adjectives": [],
     "editorial_pillars": {
       "advocates_for": [],
       "opposes": [],
       "stances": []
     },
     "avoid": [],
     "style_reference": "",
     "main_objections": [],
     "transformation": "",
     "voice_summary": "A 3-4 sentence paragraph describing the brand's core values, arguments, and style guidelines. Write it as a briefing for a copywriter."
   }
   ```

4. **Review & Save**:
   - Show the profile to the user for feedback.
   - Determine the save path:
     - If a brand-id was provided (e.g., `katana`): `user/plugins/<brand-id>/voice-profile.json` (create the directory if it does not exist).
     - Otherwise, fallback to: `brand-profile.json` at the project root.
   - Save the file and print a confirmation message showing the save location.

5. **Logo Retrieval & Configuration**:
   - Search the web for the brand's logo (preferably a vector SVG, or a transparent PNG).
   - If found, clean/sanitize it and save it to `user/canva-killer/assets/custom/logo.svg`.
   - Update the brand's JSON config `logo` property to reference this logo (e.g. `"logo": "custom/logo"`).
   - If not found, prompt the user to upload the logo SVG through the Studio's logo upload tool, or configure `logoText` inside the brand config to display a clean uppercase text fallback.
