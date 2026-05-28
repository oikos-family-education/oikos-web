/**
 * Curated emblem set for the community-identity banner (v2 spec §7.2).
 *
 * Each entry pairs a lucide-react icon component name with a display label and
 * theme group. The `id` is what the backend stores in `Community.identity.emblem`.
 *
 * If lucide ever drops an icon we use, we substitute the nearest available one
 * and keep the id stable so existing communities don't break.
 */
import {
  Anchor, Apple, Award, Baby, Bike, Bird, Book, BookOpen, Brain, Bug, Building,
  Cake, Camera, Carrot, Castle, Cat, ChefHat, Cherry, Church, Cloud, CloudRain,
  Compass, Coffee, Cross, Crown, Dice5, Dog, Drum, Dumbbell, Feather, Film,
  Fish, Flame, Flower, Gamepad2, Globe, GraduationCap, Guitar, Hammer, Heart,
  Home, Key, Lamp, Leaf, Lightbulb, Map as MapIcon, Mic, Microscope, Moon,
  Mountain, Music, Paintbrush, Palette, Piano, Puzzle, Rabbit, Rainbow, Rocket,
  Scroll, Shield, Snail, Snowflake, Soup, Sparkles, Sprout, Squirrel, Star,
  Sun, Sunrise, Sunset, Telescope, Tent, Theater, TreePine, Trees, Trophy,
  Turtle, Users, Waves, Wheat, Wind, Wrench, Pen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type EmblemGroup =
  | 'nature' | 'weather' | 'faith' | 'education'
  | 'family' | 'animals' | 'tools' | 'food' | 'arts' | 'sports';

export interface Emblem {
  id: string;
  group: EmblemGroup;
  Icon: LucideIcon;
}

export const EMBLEMS: Emblem[] = [
  // Nature
  { id: 'leaf', group: 'nature', Icon: Leaf },
  { id: 'flower', group: 'nature', Icon: Flower },
  { id: 'sprout', group: 'nature', Icon: Sprout },
  { id: 'tree_pine', group: 'nature', Icon: TreePine },
  { id: 'trees', group: 'nature', Icon: Trees },
  { id: 'sun', group: 'nature', Icon: Sun },
  { id: 'moon', group: 'nature', Icon: Moon },
  { id: 'star', group: 'nature', Icon: Star },
  { id: 'cloud', group: 'nature', Icon: Cloud },
  { id: 'mountain', group: 'nature', Icon: Mountain },
  { id: 'waves', group: 'nature', Icon: Waves },
  { id: 'wind', group: 'nature', Icon: Wind },
  { id: 'snowflake', group: 'nature', Icon: Snowflake },
  { id: 'wheat', group: 'nature', Icon: Wheat },
  { id: 'flame', group: 'nature', Icon: Flame },

  // Weather & sky
  { id: 'sunrise', group: 'weather', Icon: Sunrise },
  { id: 'sunset', group: 'weather', Icon: Sunset },
  { id: 'rainbow', group: 'weather', Icon: Rainbow },
  { id: 'cloud_rain', group: 'weather', Icon: CloudRain },

  // Faith
  { id: 'cross', group: 'faith', Icon: Cross },
  { id: 'anchor', group: 'faith', Icon: Anchor },
  { id: 'heart', group: 'faith', Icon: Heart },
  { id: 'feather', group: 'faith', Icon: Feather },
  { id: 'crown', group: 'faith', Icon: Crown },
  { id: 'church', group: 'faith', Icon: Church },
  { id: 'sparkles', group: 'faith', Icon: Sparkles },
  { id: 'lamp', group: 'faith', Icon: Lamp },

  // Education
  { id: 'book_open', group: 'education', Icon: BookOpen },
  { id: 'book', group: 'education', Icon: Book },
  { id: 'graduation_cap', group: 'education', Icon: GraduationCap },
  { id: 'scroll', group: 'education', Icon: Scroll },
  { id: 'pen', group: 'education', Icon: Pen },
  { id: 'brain', group: 'education', Icon: Brain },
  { id: 'lightbulb', group: 'education', Icon: Lightbulb },
  { id: 'microscope', group: 'education', Icon: Microscope },
  { id: 'telescope', group: 'education', Icon: Telescope },
  { id: 'globe', group: 'education', Icon: Globe },
  { id: 'compass', group: 'education', Icon: Compass },
  { id: 'map', group: 'education', Icon: MapIcon },

  // Family & home
  { id: 'home', group: 'family', Icon: Home },
  { id: 'users', group: 'family', Icon: Users },
  { id: 'baby', group: 'family', Icon: Baby },
  { id: 'tent', group: 'family', Icon: Tent },
  { id: 'castle', group: 'family', Icon: Castle },
  { id: 'building', group: 'family', Icon: Building },
  { id: 'key', group: 'family', Icon: Key },
  { id: 'shield', group: 'family', Icon: Shield },

  // Animals
  { id: 'bird', group: 'animals', Icon: Bird },
  { id: 'fish', group: 'animals', Icon: Fish },
  { id: 'cat', group: 'animals', Icon: Cat },
  { id: 'dog', group: 'animals', Icon: Dog },
  { id: 'rabbit', group: 'animals', Icon: Rabbit },
  { id: 'squirrel', group: 'animals', Icon: Squirrel },
  { id: 'turtle', group: 'animals', Icon: Turtle },
  { id: 'snail', group: 'animals', Icon: Snail },
  { id: 'bug', group: 'animals', Icon: Bug },

  // Tools & symbols
  { id: 'hammer', group: 'tools', Icon: Hammer },
  { id: 'wrench', group: 'tools', Icon: Wrench },
  { id: 'paintbrush', group: 'tools', Icon: Paintbrush },
  { id: 'palette', group: 'tools', Icon: Palette },
  { id: 'music', group: 'tools', Icon: Music },
  { id: 'mic', group: 'tools', Icon: Mic },
  { id: 'camera', group: 'tools', Icon: Camera },
  { id: 'rocket', group: 'tools', Icon: Rocket },
  { id: 'award', group: 'tools', Icon: Award },
  { id: 'trophy', group: 'tools', Icon: Trophy },

  // Food & hearth
  { id: 'coffee', group: 'food', Icon: Coffee },
  { id: 'apple', group: 'food', Icon: Apple },
  { id: 'cherry', group: 'food', Icon: Cherry },
  { id: 'carrot', group: 'food', Icon: Carrot },
  { id: 'cake', group: 'food', Icon: Cake },
  { id: 'chef_hat', group: 'food', Icon: ChefHat },
  { id: 'soup', group: 'food', Icon: Soup },

  // Music & arts
  { id: 'drum', group: 'arts', Icon: Drum },
  { id: 'guitar', group: 'arts', Icon: Guitar },
  { id: 'piano', group: 'arts', Icon: Piano },
  { id: 'theater', group: 'arts', Icon: Theater },
  { id: 'film', group: 'arts', Icon: Film },

  // Sports & games
  { id: 'bike', group: 'sports', Icon: Bike },
  { id: 'dumbbell', group: 'sports', Icon: Dumbbell },
  { id: 'gamepad2', group: 'sports', Icon: Gamepad2 },
  { id: 'puzzle', group: 'sports', Icon: Puzzle },
  { id: 'dice5', group: 'sports', Icon: Dice5 },
];

export const EMBLEM_GROUPS: { id: EmblemGroup; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'weather', label: 'Weather' },
  { id: 'faith', label: 'Faith' },
  { id: 'education', label: 'Education' },
  { id: 'family', label: 'Family & home' },
  { id: 'animals', label: 'Animals' },
  { id: 'tools', label: 'Tools' },
  { id: 'food', label: 'Food & hearth' },
  { id: 'arts', label: 'Music & arts' },
  { id: 'sports', label: 'Sports & games' },
];

const BY_ID = new Map(EMBLEMS.map((e) => [e.id, e]));

export function findEmblem(id: string | null | undefined): Emblem | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export const DEFAULT_PRIMARY = '#1B2A4A';
export const DEFAULT_SECONDARY = '#4F46E5';
export const DEFAULT_EMBLEM_COLOR = '#FFFFFF';
