export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.(js|jsx)$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-native|@react-native|expo|expo-notifications|expo-location|react-native-safe-area-context|react-native-screens)/)'
  ]
};
