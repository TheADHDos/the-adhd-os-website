const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let wins = [];
  let dump = "";

  try {
    const body = JSON.parse(event.body);
    wins = body.wins || [];
    dump = body.dump || "";
  } catch (e) {
    return { statusCode: 400, body: "Invalid request body" };
  }

  const hasWins = wins.length > 0;
  const hasDump = dump.trim().length > 0;

  if (!hasWins && !hasDump) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reframe: "Sleep is the work." }),
    };
  }

  const winsText = hasWins
    ? `Evidence logged today:\n${wins.map((w, i) => `${i + 1}. ${w}`).join("\n")}`
    : "";

  const dumpText = hasDump
    ? `Open threads offloaded:\n${dump}`
    : "";

  const prompt = `You are closing out a day for someone with ADHD. Based on what they actually did today, write a single closing reframe — one sentence, specific to their day, warm but not saccharine, that helps them cross the threshold from work to rest.

${winsText}
${dumpText}

Rules:
- One sentence only. No preamble, no explanation, just the sentence.
- Reference something specific from their actual day — not a generic affirmation.
- Tone: earned, direct, warm. Like a coach who saw the whole session.
- Do not start with "You" — vary the sentence structure.
- Do not use the word "journey" or "proud."
- The sentence should make it easier to stop, not motivate more work.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const reframe = message.content[0].text.trim();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ reframe }),
    };
  } catch (err) {
    console.error("Claude API error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reframe: "Sleep is the work." }),
    };
  }
};
