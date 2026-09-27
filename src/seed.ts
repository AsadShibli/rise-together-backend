import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "./db";
import { Template } from "./models";

const textSlots = ["headline", "footer"];

// Starter layouts. A title that already exists is skipped.
const templates = [
  { title: "মহান বিজয় দিবস", occasionType: "বিজয় দিবস", colors: ["#006A4E", "#F42A41"], photoSlots: 3 },
  { title: "শোক সংবাদ", occasionType: "শোক", colors: ["#000000", "#FFFFFF"], photoSlots: 1 },
  { title: "নির্বাচনী প্রচার", occasionType: "নির্বাচন", colors: ["#006A4E", "#F42A41"], photoSlots: 2 },
  { title: "শুভেচ্ছা", occasionType: "শুভেচ্ছা", colors: ["#006A4E", "#C9A227"], photoSlots: 2 },
  { title: "ঈদ শুভেচ্ছা", occasionType: "ঈদ", colors: ["#0B6E4F", "#F4F1DE"], photoSlots: 1 },
];

async function seed() {
  await connectDb();
  let created = 0;
  for (const item of templates) {
    const found = await Template.findOne({ title: item.title });
    if (found) continue;
    await Template.create({
      title: item.title,
      occasionType: item.occasionType,
      thumbnailUrl: "",
      isActive: true,
      layoutConfig: { colors: item.colors, photoSlots: item.photoSlots, textSlots },
    });
    created += 1;
  }
  console.log(`${created} created`);
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
