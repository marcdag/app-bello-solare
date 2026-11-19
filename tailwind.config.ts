import type { Config } from 'tailwindcss';

// Cores tiradas do logo do Condomínio Parque Bello Solare
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: { DEFAULT: '#1A23A0', escuro: '#111A80', claro: '#E8EBFB' },
        marinho: '#0B1260',
        ceu: '#1CC3F2',
        sol: '#F5A623',
        tinta: '#13202B',
        cinza: { texto: '#4F5D6B', borda: '#E1E6EB', campo: '#C9D2DA', fundo: '#F2F5FB' },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
