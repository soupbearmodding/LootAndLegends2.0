import tailwindcss from 'tailwindcss'; // Use standard import for v3
import autoprefixer from 'autoprefixer';

export default {
  plugins: [
    tailwindcss, // No need to pass config path explicitly for v3 usually
    autoprefixer,
  ],
};
