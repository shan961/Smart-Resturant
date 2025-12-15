import express from "express";
import dotenv from "dotenv";
import { z } from "zod";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* ---------------- BASIC SETUP ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- MENU DATA ---------------- */

const menus = {
  breakfast: [
    { name: "Aloo Paratha", price: 40 },
    { name: "Poha", price: 30 },
    { name: "Idli Sambar", price: 35 },
    { name: "Dosa with Coconut Chutney", price: 40 },
    { name: "Bread Omelette", price: 35 },
    { name: "Filter Coffee", price: 20 }
  ],
  lunch: [
    { name: "Paneer Butter Masala", price: 120 },
    { name: "Dal Tadka", price: 80 },
    { name: "Jeera Rice", price: 60 },
    { name: "Roti (2 pieces)", price: 20 },
    { name: "Rajma Masala", price: 100 },
    { name: "Vegetable Biryani", price: 130 },
    { name: "Salad", price: 40 },
    { name: "Mango Lassi", price: 50 }
  ],
  dinner: [
    { name: "Veg Biryani", price: 130 },
    { name: "Matar Paneer", price: 120 },
    { name: "Dal Makhani", price: 100 },
    { name: "Butter Naan (2 pieces)", price: 40 },
    { name: "Gulab Jamun", price: 40 },
    { name: "Masala Chai", price: 20 }
  ]
};

/* ---------------- TOOLS ---------------- */

// Menu Tool
const getMenuTool = new DynamicStructuredTool({
  name: "getMenu",
  description: "Get menu for breakfast, lunch or dinner",
  schema: z.object({
    category: z.string()
  }),
  func: async ({ category }) => {
    const cat = category.toLowerCase();
    if (!menus[cat]) return "Sorry, I don't have that menu.";
    return menus[cat].map(i => `${i.name} (₹${i.price})`).join(", ");
  }
});

// Breakfast Planner
const planBreakfastTool = new DynamicStructuredTool({
  name: "planBreakfast",
  description: "Suggest a breakfast",
  schema: z.object({}),
  func: async () =>
    `A nice breakfast would be ${menus.breakfast
      .slice(0, 3)
      .map(i => i.name)
      .join(", ")}.`
});

// Lunch Planner
const planLunchTool = new DynamicStructuredTool({
  name: "planLunch",
  description: "Suggest a lunch",
  schema: z.object({}),
  func: async () =>
    `For lunch, I’d suggest ${menus.lunch
      .slice(0, 4)
      .map(i => i.name)
      .join(", ")}.`
});

// Dinner Planner
const planDinnerTool = new DynamicStructuredTool({
  name: "planDinner",
  description: "Suggest a dinner",
  schema: z.object({}),
  func: async () =>
    `For dinner tonight, ${menus.dinner
      .slice(0, 4)
      .map(i => i.name)
      .join(", ")} would be a great choice.`
});

// Health Advice
const healthFoodAdviceTool = new DynamicStructuredTool({
  name: "healthFoodAdvice",
  description: "Food advice for health conditions",
  schema: z.object({
    condition: z.string()
  }),
  func: async ({ condition }) => {
    const c = condition.toLowerCase();
    if (c.includes("cold"))
      return "Warm soups, tea and light food are best when you have a cold.";
    if (c.includes("stomach"))
      return "Go for light meals like rice, curd and banana.";
    return "Try to eat light, fresh food and stay hydrated.";
  }
});

// Speciality
const specialityTool = new DynamicStructuredTool({
  name: "speciality",
  description: "Restaurant speciality",
  schema: z.object({}),
  func: async () =>
    "Our most loved dishes are Paneer Butter Masala, Dal Makhani and Veg Biryani."
});

// Opening Hours
const openingHoursTool = new DynamicStructuredTool({
  name: "openingHours",
  description: "Restaurant opening hours",
  schema: z.object({}),
  func: async () => "We are open every day from 7 AM to 11 PM."
});

/* ---------------- TOOLS ARRAY ---------------- */

const tools = [
  getMenuTool,
  planBreakfastTool,
  planLunchTool,
  planDinnerTool,
  healthFoodAdviceTool,
  specialityTool,
  openingHoursTool
];

/* ---------------- MODEL ---------------- */

const model = new ChatGoogleGenerativeAI({
  model: "models/gemini-2.5-flash",
  temperature: 0.6
});

const modelWithTools = model.bindTools(tools);

/* ---------------- SYSTEM PROMPT (NATURAL) ---------------- */

const systemPrompt = new SystemMessage(`
You are a friendly, polite restaurant assistant.

Speak naturally like a real human waiter.
Be warm, helpful and conversational.
Do not mention tools or technical details.

Use tools ONLY when needed for:
- menu
- breakfast, lunch or dinner planning
- health-related food advice
- opening hours
- restaurant speciality

If asked about taste or personal experience, say:
"I can’t taste food, but I can help you choose."

Keep answers short, friendly and natural.
`);

/* ---------------- CHAT API ---------------- */

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await modelWithTools.invoke([
      systemPrompt,
      new HumanMessage(message)
    ]);

    if (response.tool_calls?.length) {
      const call = response.tool_calls[0];
      const tool = tools.find(t => t.name === call.name);
      const result = await tool.func(call.args);
      return res.json({ source: "tool", answer: result });
    }

    res.json({ source: "gemini", answer: response.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
