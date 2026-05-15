import useAppStore from '../store/appStore';

export const loadUserData = (user, attributes) => {
  const store = useAppStore.getState();
  const username = user?.username || '';
  const role = attributes['custom:role'] || 'student';

  if (role === 'teacher') {
    // Teacher data
    store.setCurrentUser({
      username: username,
      email: attributes.email,
      name: attributes.name,
      role: role,
      school_node: attributes['custom:school_node'],
      subject: attributes['custom:subject']
    });
    store.setUserRole(role);
    return;
  }

  if (username === 'Test_1' || attributes?.email?.toLowerCase().includes('test_1')) {
    // Demo User Data
    store.setCurrentUser({
      username: username,
      email: attributes.email,
      name: 'Ahmad Firdaus',
      role: role,
      grade: 'Tingkatan 4',
      village: 'Kg. Baru',
      school_node: 'SK Kg. Baru Node'
    });
    store.setUserRole(role);
    store.setStreak(7);
    
    useAppStore.setState({
      progress: {
        '1': 65,
        '2': 30,
        '3': 90,
        '4': 10,
        '5': 45
      },
      quizResults: [
        { lessonId: '1', score: 4, total: 5, date: '10/05/2026', subject: 'Science' },
        { lessonId: '2', score: 3, total: 5, date: '09/05/2026', subject: 'Mathematics' },
        { lessonId: '3', score: 5, total: 5, date: '08/05/2026', subject: 'Bahasa Malaysia' },
        { lessonId: '4', score: 2, total: 5, date: '07/05/2026', subject: 'History' },
        { lessonId: '5', score: 4, total: 5, date: '06/05/2026', subject: 'English' }
      ]
    });
  } else {
    // Real student data — load from Cognito custom attributes
    let loadedProgress = {};
    let loadedQuizResults = [];
    let loadedStreak = 0;

    if (attributes['custom:app_data']) {
      try {
        const data = JSON.parse(attributes['custom:app_data']);
        loadedProgress = data.progress || {};
        loadedQuizResults = data.quizResults || [];
        loadedStreak = data.streak || 0;
      } catch (e) {
        console.error('Failed to parse app_data', e);
      }
    }

    store.setCurrentUser({
      username: username,
      email: attributes.email,
      name: attributes.name || 'Student',
      role: role,
      grade: attributes['custom:grade'] || '',
      village: attributes['custom:village'] || '',
      school_node: attributes['custom:school_node'] || ''
    });
    store.setUserRole(role);
    store.setStreak(loadedStreak);
    useAppStore.setState({ progress: loadedProgress, quizResults: loadedQuizResults });
  }
};

let syncTimeout = null;
export const saveProgressToCloud = () => {
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(async () => {
    const store = useAppStore.getState();
    const username = store.currentUser?.username;
    
    // Don't save if not logged in or if it's the demo user
    if (!store.isAuthenticated || username === 'Test_1') return;

    const appData = JSON.stringify({
      progress: store.progress,
      quizResults: store.quizResults,
      streak: store.streak
    });

    try {
      // Lazy import to prevent circular dependency issues
      const { updateUserAttributes } = await import('aws-amplify/auth');
      await updateUserAttributes({
        userAttributes: {
          'custom:app_data': appData
        }
      });
      console.log('Progress synced to AWS Cognito');
    } catch (e) {
      console.error('Failed to sync progress to AWS', e);
    }
  }, 3000); // 3 second debounce
};
