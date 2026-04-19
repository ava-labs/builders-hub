import type { FullQuizData, Course, QuizDataStructure } from './types';

import blockchainFundamentals from './courses/blockchain-fundamentals.json';
import encryptedErc from './courses/encrypted-erc.json';
import nftDeployment from './courses/nft-deployment.json';
import x402PaymentInfrastructure from './courses/x402-payment-infrastructure.json';
import avalancheFundamentals from './courses/avalanche-fundamentals.json';
import accessRestriction from './courses/access-restriction.json';
import avacloudapis from './courses/avacloudapis.json';
import customizingEvm from './courses/customizing-evm.json';
import icmChainlink from './courses/icm-chainlink.json';
import erc20Bridge from './courses/erc20-bridge.json';
import l1NativeTokenomics from './courses/l1-native-tokenomics.json';
import interchainTokenTransfer from './courses/interchain-token-transfer.json';
import interchainMessaging from './courses/interchain-messaging.json';
import nativeTokenBridge from './courses/native-token-bridge.json';
import permissionlessL1s from './courses/permissionless-l1s.json';
import multichainArchitecture from './courses/multichain-architecture.json';
import permissionedL1s from './courses/permissioned-l1s.json';
import foundationsWeb3Venture from './courses/foundations-web3-venture.json';
import web3CommunityArchitect from './courses/web3-community-architect.json';
import goToMarket from './courses/go-to-market.json';
import fundraisingFinance from './courses/fundraising-finance.json';
import team1Fundamentals from './courses/team1-fundamentals.json';
import team1TechnicalMember from './courses/team1-technical-member.json';
import team1AdvancedTechnicalMember from './courses/team1-advanced-technical-member.json';
import team1SoftSkills from './courses/team1-soft-skills.json';

const courseFiles: Record<string, { title: string; quizzes: Record<string, unknown> }> = {
  'blockchain-fundamentals': blockchainFundamentals,
  'encrypted-erc': encryptedErc,
  'nft-deployment': nftDeployment,
  'x402-payment-infrastructure': x402PaymentInfrastructure,
  'avalanche-fundamentals': avalancheFundamentals,
  'access-restriction': accessRestriction,
  'avacloudapis': avacloudapis,
  'customizing-evm': customizingEvm,
  'icm-chainlink': icmChainlink,
  'erc20-bridge': erc20Bridge,
  'l1-native-tokenomics': l1NativeTokenomics,
  'interchain-token-transfer': interchainTokenTransfer,
  'interchain-messaging': interchainMessaging,
  'native-token-bridge': nativeTokenBridge,
  'permissionless-l1s': permissionlessL1s,
  'multichain-architecture': multichainArchitecture,
  'permissioned-l1s': permissionedL1s,
  'foundations-web3-venture': foundationsWeb3Venture,
  'web3-community-architect': web3CommunityArchitect,
  'go-to-market': goToMarket,
  'fundraising-finance': fundraisingFinance,
  'team1-fundamentals': team1Fundamentals,
  'team1-technical-member': team1TechnicalMember,
  'team1-advanced-technical-member': team1AdvancedTechnicalMember,
  'team1-soft-skills': team1SoftSkills,
};

const courses: Record<string, Course> = {};
const quizzes: Record<string, FullQuizData> = {};

for (const [courseId, data] of Object.entries(courseFiles)) {
  courses[courseId] = {
    title: data.title,
    quizzes: Object.keys(data.quizzes),
  };
  Object.assign(quizzes, data.quizzes);
}

const quizData: QuizDataStructure = { courses, quizzes };
export default quizData;

export type { QuizData, FullQuizData, Course, QuizDataStructure } from './types';
