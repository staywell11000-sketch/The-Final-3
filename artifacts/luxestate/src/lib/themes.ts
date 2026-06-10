export type Theme = {
  id: string
  name: string
  description: string
  dark: boolean
  swatches: string[]
  preview: {
    bg: string
    sidebar: string
    card: string
    primary: string
    text: string
    muted: string
    border: string
  }
}

export type ThemePair = {
  label: string
  light: Theme
  dark: Theme
}

export const THEMES: Theme[] = [
  {
    id: "gold",
    name: "Gold",
    description: "Warm amber — luxurious and bold",
    dark: false,
    swatches: ["#C4943A", "#E8C88A", "#FDF6E8"],
    preview: {
      bg:      "#FDF6E8",
      sidebar: "#FFFCF4",
      card:    "#FFFFFF",
      primary: "#C4943A",
      text:    "#2A1E0A",
      muted:   "#8A7040",
      border:  "#EAD9A8",
    },
  },
  {
    id: "dark",
    name: "Dark",
    description: "Charcoal dark — easy on the eyes",
    dark: true,
    swatches: ["#C4943A", "#2A2A35", "#1A1A24"],
    preview: {
      bg:      "#1A1A24",
      sidebar: "#141420",
      card:    "#22222F",
      primary: "#C4943A",
      text:    "#F0EFE8",
      muted:   "#8A8898",
      border:  "#2E2E3E",
    },
  },
  {
    id: "light",
    name: "Light",
    description: "Clean white — crisp and minimal",
    dark: false,
    swatches: ["#3B7FD4", "#FFFFFF", "#F4F6FB"],
    preview: {
      bg:      "#F4F6FB",
      sidebar: "#FFFFFF",
      card:    "#FFFFFF",
      primary: "#3B7FD4",
      text:    "#1A2233",
      muted:   "#8A95A8",
      border:  "#DDE3ED",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy — rich and immersive",
    dark: true,
    swatches: ["#4F8EF7", "#0D1526", "#060E1C"],
    preview: {
      bg:      "#0C1525",
      sidebar: "#07101E",
      card:    "#111F35",
      primary: "#4F8EF7",
      text:    "#E8EFF8",
      muted:   "#7A90B0",
      border:  "#1A2D48",
    },
  },
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    description: "Professional blue — sharp and confident",
    dark: false,
    swatches: ["#1B5FD4", "#4A8FE8", "#EEF3FD"],
    preview: {
      bg:      "#EEF3FD",
      sidebar: "#FAFCFF",
      card:    "#FFFFFF",
      primary: "#1B5FD4",
      text:    "#0F2040",
      muted:   "#5A7299",
      border:  "#C8D9F5",
    },
  },
  {
    id: "corporate-blue-dark",
    name: "Corporate Blue Dark",
    description: "Deep navy — powerful and precise",
    dark: true,
    swatches: ["#4F8EF7", "#0A0F1E", "#060B18"],
    preview: {
      bg:      "#0A0F1E",
      sidebar: "#060B18",
      card:    "#101826",
      primary: "#4F8EF7",
      text:    "#E8EFF8",
      muted:   "#7A90B0",
      border:  "#1A2D45",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Rich green — fresh and prestige",
    dark: false,
    swatches: ["#1A8C5C", "#42B47E", "#EEF7F2"],
    preview: {
      bg:      "#EEF7F2",
      sidebar: "#FAFFFE",
      card:    "#FFFFFF",
      primary: "#1A8C5C",
      text:    "#0F2818",
      muted:   "#5A8C72",
      border:  "#C0E0D0",
    },
  },
  {
    id: "emerald-dark",
    name: "Emerald Dark",
    description: "Deep forest — rich and immersive",
    dark: true,
    swatches: ["#3DB87A", "#0A1610", "#071210"],
    preview: {
      bg:      "#0A1610",
      sidebar: "#071210",
      card:    "#0F1E15",
      primary: "#3DB87A",
      text:    "#E6F2EB",
      muted:   "#6BA882",
      border:  "#182E20",
    },
  },
  {
    id: "modern-gray",
    name: "Modern Gray",
    description: "Neutral slate — clean and versatile",
    dark: false,
    swatches: ["#4A6080", "#8AA0BC", "#F0F3F7"],
    preview: {
      bg:      "#F0F3F7",
      sidebar: "#FAFBFD",
      card:    "#FFFFFF",
      primary: "#4A6080",
      text:    "#1A2530",
      muted:   "#6A7D90",
      border:  "#D0D9E4",
    },
  },
  {
    id: "modern-gray-dark",
    name: "Modern Gray Dark",
    description: "Charcoal slate — refined and minimal",
    dark: true,
    swatches: ["#7899BE", "#181C28", "#10141E"],
    preview: {
      bg:      "#181C28",
      sidebar: "#10141E",
      card:    "#1E2435",
      primary: "#7899BE",
      text:    "#E8ECF4",
      muted:   "#8090A8",
      border:  "#2A3048",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Coastal blue — fresh and professional",
    dark: false,
    swatches: ["#2B7FD4", "#7AB8F0", "#EEF5FC"],
    preview: {
      bg:      "#EEF5FC",
      sidebar: "#F7FAFD",
      card:    "#FFFFFF",
      primary: "#2B7FD4",
      text:    "#0D2540",
      muted:   "#5A82A8",
      border:  "#C8DEF0",
    },
  },
  {
    id: "ocean-dark",
    name: "Ocean Dark",
    description: "Deep sea — cool and immersive",
    dark: true,
    swatches: ["#4F8EF7", "#091520", "#060E18"],
    preview: {
      bg:      "#091520",
      sidebar: "#060E18",
      card:    "#0E1D2C",
      primary: "#4F8EF7",
      text:    "#E8EFF8",
      muted:   "#6A90B8",
      border:  "#162840",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Blush pink — warm and inviting",
    dark: false,
    swatches: ["#D4527A", "#EE9AB5", "#FCF0F3"],
    preview: {
      bg:      "#FCF0F3",
      sidebar: "#FDF7F8",
      card:    "#FFFFFF",
      primary: "#D4527A",
      text:    "#3A1020",
      muted:   "#A06878",
      border:  "#EAC8D4",
    },
  },
  {
    id: "rose-dark",
    name: "Rose Dark",
    description: "Deep crimson — bold and dramatic",
    dark: true,
    swatches: ["#E0607A", "#180C10", "#100810"],
    preview: {
      bg:      "#180C10",
      sidebar: "#100810",
      card:    "#201018",
      primary: "#E0607A",
      text:    "#F2E8EC",
      muted:   "#9A6878",
      border:  "#2E1820",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool slate — sharp and professional",
    dark: false,
    swatches: ["#4A6585", "#8AAAC8", "#EEF1F6"],
    preview: {
      bg:      "#EEF1F6",
      sidebar: "#F5F7FA",
      card:    "#FFFFFF",
      primary: "#4A6585",
      text:    "#1A2535",
      muted:   "#6A8098",
      border:  "#C8D4E0",
    },
  },
  {
    id: "slate-dark",
    name: "Slate Dark",
    description: "Deep slate — sharp and professional",
    dark: true,
    swatches: ["#6E8CB0", "#141820", "#0E1218"],
    preview: {
      bg:      "#141820",
      sidebar: "#0E1218",
      card:    "#1A2030",
      primary: "#6E8CB0",
      text:    "#E8ECF4",
      muted:   "#788898",
      border:  "#222C3C",
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Soft violet — creative and elegant",
    dark: false,
    swatches: ["#6B4FD4", "#AA90EE", "#F3F0FC"],
    preview: {
      bg:      "#F3F0FC",
      sidebar: "#F8F6FE",
      card:    "#FFFFFF",
      primary: "#6B4FD4",
      text:    "#1A1030",
      muted:   "#7868A8",
      border:  "#D8CCF0",
    },
  },
  {
    id: "violet-dark",
    name: "Violet Dark",
    description: "Deep violet — rich and commanding",
    dark: true,
    swatches: ["#8B6EE8", "#130E1C", "#0E0A14"],
    preview: {
      bg:      "#130E1C",
      sidebar: "#0E0A14",
      card:    "#1A1228",
      primary: "#8B6EE8",
      text:    "#EDE8F8",
      muted:   "#8878A8",
      border:  "#251A38",
    },
  },
]

export const THEME_PAIRS: ThemePair[] = [
  {
    label: "Gold & Amber",
    light: THEMES.find(t => t.id === "gold")!,
    dark:  THEMES.find(t => t.id === "dark")!,
  },
  {
    label: "Blue",
    light: THEMES.find(t => t.id === "light")!,
    dark:  THEMES.find(t => t.id === "midnight")!,
  },
  {
    label: "Corporate Blue",
    light: THEMES.find(t => t.id === "corporate-blue")!,
    dark:  THEMES.find(t => t.id === "corporate-blue-dark")!,
  },
  {
    label: "Emerald",
    light: THEMES.find(t => t.id === "emerald")!,
    dark:  THEMES.find(t => t.id === "emerald-dark")!,
  },
  {
    label: "Modern Gray",
    light: THEMES.find(t => t.id === "modern-gray")!,
    dark:  THEMES.find(t => t.id === "modern-gray-dark")!,
  },
  {
    label: "Ocean",
    light: THEMES.find(t => t.id === "ocean")!,
    dark:  THEMES.find(t => t.id === "ocean-dark")!,
  },
  {
    label: "Rose",
    light: THEMES.find(t => t.id === "rose")!,
    dark:  THEMES.find(t => t.id === "rose-dark")!,
  },
  {
    label: "Slate",
    light: THEMES.find(t => t.id === "slate")!,
    dark:  THEMES.find(t => t.id === "slate-dark")!,
  },
  {
    label: "Violet",
    light: THEMES.find(t => t.id === "violet")!,
    dark:  THEMES.find(t => t.id === "violet-dark")!,
  },
]
