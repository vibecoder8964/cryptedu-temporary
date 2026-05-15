import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-southeast-5_KI27lU59V',
      userPoolClientId: '3igvjqrogfepkabl711u2tog3t',
      region: 'ap-southeast-5',
    }
  }
});
