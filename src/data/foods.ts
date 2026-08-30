/**
 * Compact reference table used by the on-device photo estimator when no
 * Anthropic key is configured. Values are per 100 g, from common nutrition
 * reference ranges, plus a typical single-serving weight.
 */
export interface FoodRef {
  name: string
  /** search aliases */
  alias?: string[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  /** typical serving in grams */
  serving: number
}

export const FOOD_REF: FoodRef[] = [
  { name: 'grilled chicken breast', alias: ['chicken', 'chicken breast'], kcal: 165, protein: 31, carbs: 0, fat: 3.6, serving: 150 },
  { name: 'fried chicken', alias: ['fried chicken', 'chicken wings'], kcal: 290, protein: 25, carbs: 11, fat: 17, serving: 150 },
  { name: 'salmon fillet', alias: ['salmon', 'fish'], kcal: 208, protein: 20, carbs: 0, fat: 13, serving: 150 },
  { name: 'white fish', alias: ['cod', 'haddock', 'tilapia'], kcal: 105, protein: 23, carbs: 0, fat: 1, serving: 150 },
  { name: 'prawns', alias: ['shrimp', 'prawn'], kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, serving: 120 },
  { name: 'beef steak', alias: ['steak', 'beef'], kcal: 250, protein: 26, carbs: 0, fat: 16, serving: 180 },
  { name: 'minced beef', alias: ['ground beef', 'mince'], kcal: 254, protein: 26, carbs: 0, fat: 17, serving: 150 },
  { name: 'pork chop', alias: ['pork'], kcal: 231, protein: 26, carbs: 0, fat: 14, serving: 160 },
  { name: 'bacon', alias: ['bacon rashers'], kcal: 541, protein: 37, carbs: 1.4, fat: 42, serving: 40 },
  { name: 'egg', alias: ['eggs', 'fried egg', 'boiled egg', 'omelette', 'scrambled eggs'], kcal: 155, protein: 13, carbs: 1.1, fat: 11, serving: 100 },
  { name: 'tofu', alias: ['bean curd'], kcal: 144, protein: 15, carbs: 3, fat: 9, serving: 150 },
  { name: 'paneer', alias: [], kcal: 296, protein: 20, carbs: 4, fat: 22, serving: 120 },
  { name: 'chickpeas', alias: ['garbanzo', 'chana'], kcal: 164, protein: 9, carbs: 27, fat: 2.6, serving: 150 },
  { name: 'black beans', alias: ['beans', 'kidney beans'], kcal: 132, protein: 9, carbs: 24, fat: 0.5, serving: 150 },
  { name: 'lentils', alias: ['dal', 'daal', 'lentil soup'], kcal: 116, protein: 9, carbs: 20, fat: 0.4, serving: 200 },

  { name: 'white rice', alias: ['rice', 'steamed rice', 'jasmine rice', 'basmati'], kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: 180 },
  { name: 'brown rice', alias: [], kcal: 123, protein: 2.7, carbs: 26, fat: 1, serving: 180 },
  { name: 'fried rice', alias: [], kcal: 186, protein: 6, carbs: 27, fat: 6, serving: 250 },
  { name: 'pasta', alias: ['spaghetti', 'penne', 'noodles', 'macaroni'], kcal: 158, protein: 6, carbs: 31, fat: 0.9, serving: 220 },
  { name: 'egg noodles', alias: ['ramen', 'chow mein'], kcal: 138, protein: 4.5, carbs: 25, fat: 2.1, serving: 220 },
  { name: 'quinoa', alias: [], kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, serving: 180 },
  { name: 'couscous', alias: ['bulgur'], kcal: 112, protein: 3.8, carbs: 23, fat: 0.2, serving: 180 },
  { name: 'bread', alias: ['toast', 'sourdough', 'slice of bread', 'sandwich'], kcal: 265, protein: 9, carbs: 49, fat: 3.2, serving: 60 },
  { name: 'bagel', alias: [], kcal: 250, protein: 10, carbs: 49, fat: 1.5, serving: 100 },
  { name: 'tortilla wrap', alias: ['wrap', 'burrito', 'tortilla'], kcal: 290, protein: 8, carbs: 49, fat: 7, serving: 90 },
  { name: 'naan', alias: ['roti', 'chapati', 'flatbread', 'pita'], kcal: 275, protein: 9, carbs: 50, fat: 5, serving: 90 },
  { name: 'potato', alias: ['boiled potato', 'baked potato', 'mash'], kcal: 87, protein: 2, carbs: 20, fat: 0.1, serving: 200 },
  { name: 'french fries', alias: ['fries', 'chips', 'wedges'], kcal: 312, protein: 3.4, carbs: 41, fat: 15, serving: 130 },
  { name: 'oats', alias: ['porridge', 'oatmeal', 'overnight oats'], kcal: 68, protein: 2.4, carbs: 12, fat: 1.4, serving: 250 },
  { name: 'cereal', alias: ['granola', 'muesli'], kcal: 420, protein: 9, carbs: 68, fat: 12, serving: 60 },

  { name: 'pizza slice', alias: ['pizza'], kcal: 266, protein: 11, carbs: 33, fat: 10, serving: 125 },
  { name: 'burger', alias: ['cheeseburger', 'hamburger'], kcal: 254, protein: 13, carbs: 22, fat: 12, serving: 220 },
  { name: 'sushi roll', alias: ['sushi', 'maki', 'nigiri'], kcal: 145, protein: 6, carbs: 27, fat: 1.5, serving: 200 },
  { name: 'curry', alias: ['tikka masala', 'butter chicken', 'korma'], kcal: 160, protein: 10, carbs: 9, fat: 10, serving: 300 },
  { name: 'soup', alias: ['broth', 'stew'], kcal: 55, protein: 3, carbs: 7, fat: 1.8, serving: 350 },
  { name: 'salad', alias: ['green salad', 'garden salad'], kcal: 45, protein: 2, carbs: 6, fat: 1.5, serving: 200 },
  { name: 'caesar salad', alias: [], kcal: 145, protein: 6, carbs: 6, fat: 11, serving: 250 },
  { name: 'sandwich', alias: ['panini', 'sub', 'baguette'], kcal: 245, protein: 12, carbs: 28, fat: 9, serving: 230 },
  { name: 'taco', alias: ['tacos', 'quesadilla'], kcal: 226, protein: 11, carbs: 20, fat: 11, serving: 150 },
  { name: 'stir-fry', alias: ['stir fry', 'wok'], kcal: 120, protein: 9, carbs: 11, fat: 4.5, serving: 350 },

  { name: 'greek yoghurt', alias: ['yoghurt', 'yogurt', 'curd'], kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, serving: 170 },
  { name: 'milk', alias: ['semi-skimmed milk'], kcal: 50, protein: 3.4, carbs: 5, fat: 2, serving: 250 },
  { name: 'cheese', alias: ['cheddar', 'mozzarella', 'feta'], kcal: 350, protein: 24, carbs: 2, fat: 28, serving: 40 },
  { name: 'butter', alias: [], kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, serving: 10 },
  { name: 'olive oil', alias: ['oil'], kcal: 884, protein: 0, carbs: 0, fat: 100, serving: 14 },
  { name: 'hummus', alias: [], kcal: 166, protein: 8, carbs: 14, fat: 10, serving: 60 },
  { name: 'peanut butter', alias: ['almond butter', 'nut butter'], kcal: 588, protein: 25, carbs: 20, fat: 50, serving: 20 },
  { name: 'nuts', alias: ['almonds', 'cashews', 'walnuts'], kcal: 607, protein: 21, carbs: 21, fat: 51, serving: 30 },
  { name: 'avocado', alias: [], kcal: 160, protein: 2, carbs: 9, fat: 15, serving: 100 },

  { name: 'banana', alias: [], kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, serving: 120 },
  { name: 'apple', alias: [], kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, serving: 180 },
  { name: 'berries', alias: ['strawberries', 'blueberries', 'raspberries'], kcal: 50, protein: 1, carbs: 12, fat: 0.3, serving: 150 },
  { name: 'orange', alias: ['mandarin', 'clementine'], kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, serving: 160 },
  { name: 'mango', alias: [], kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, serving: 165 },
  { name: 'grapes', alias: [], kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, serving: 150 },
  { name: 'mixed vegetables', alias: ['veg', 'vegetables', 'broccoli', 'greens', 'spinach'], kcal: 45, protein: 3, carbs: 7, fat: 0.4, serving: 200 },
  { name: 'corn', alias: ['sweetcorn'], kcal: 96, protein: 3.4, carbs: 21, fat: 1.5, serving: 150 },

  { name: 'chocolate', alias: ['chocolate bar', 'dark chocolate'], kcal: 546, protein: 5, carbs: 61, fat: 31, serving: 40 },
  { name: 'biscuits', alias: ['cookies', 'cookie'], kcal: 480, protein: 6, carbs: 64, fat: 22, serving: 40 },
  { name: 'cake', alias: ['brownie', 'muffin', 'pastry', 'croissant'], kcal: 380, protein: 5, carbs: 50, fat: 18, serving: 90 },
  { name: 'ice cream', alias: ['gelato'], kcal: 207, protein: 3.5, carbs: 24, fat: 11, serving: 100 },
  { name: 'crisps', alias: ['potato chips', 'chips packet'], kcal: 536, protein: 7, carbs: 53, fat: 34, serving: 30 },
  { name: 'protein shake', alias: ['smoothie', 'protein bar'], kcal: 90, protein: 10, carbs: 8, fat: 1.8, serving: 300 },
  { name: 'coffee with milk', alias: ['latte', 'cappuccino', 'coffee'], kcal: 40, protein: 2.2, carbs: 3.8, fat: 1.6, serving: 250 },
  { name: 'beer', alias: [], kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, serving: 330 },
  { name: 'wine', alias: ['red wine', 'white wine'], kcal: 83, protein: 0.1, carbs: 2.6, fat: 0, serving: 150 },
  { name: 'soft drink', alias: ['cola', 'soda', 'juice'], kcal: 42, protein: 0, carbs: 10.6, fat: 0, serving: 330 },
]

/** Rough multipliers applied to the reference serving size. */
export const PORTION_SCALE = {
  small: 0.65,
  medium: 1,
  large: 1.5,
  huge: 2.1,
} as const

export type PortionSize = keyof typeof PORTION_SCALE
