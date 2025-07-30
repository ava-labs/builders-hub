classDiagram
    class ACP99Manager {
        initializeValidatorSet()
        completeValidatorRegistration()
        completeValidatorRemoval()
        completeValidatorWeightUpdate()
    }
    <<Abstract>> ACP99Manager

    class ValidatorManager {
        initializeValidatorSet()
        completeValidatorRegistration() onlyOwner
        completeValidatorRemoval() onlyOwner
        completeValidatorWeightUpdate() onlyOwner
        initiateValidatorRegistration() onlyOwner
        initiateValidatorRemoval() onlyOwner
        initiateValidatorWeightUpdate() onlyOwner
    }

    class PoAManager {
        completeValidatorRegistration()
        completeValidatorRemoval()
        completeValidatorWeightUpdate()
        initiateValidatorRegistration() onlyOwner
        initiateValidatorRemoval() onlyOwner
        initiateValidatorWeightUpdate() onlyOwner
        transferValidatorManagerOwnership() onlyOwner
    }

    class StakingManager {
        completeValidatorRegistration()
        initiateValidatorRemoval()
        completeValidatorRemoval()
        completeDelegatorRegistration()
        initiateDelegatorRemoval()
        completeDelegatorRemoval()
    }
    <<Abstract>> StakingManager
    
    class ERC20TokenStakingManager {
        initiateValidatorRegistration()
        initiateDelegatorRegistration()
    }
    
    class NativeTokenStakingManager {
        initiateValidatorRegistration() payable
        initiateDelegatorRegistration() payable
    }

    ACP99Manager <|-- ValidatorManager
    ValidatorManager --o PoAManager : owner
    ValidatorManager --o StakingManager : owner
    StakingManager <|-- ERC20TokenStakingManager
    StakingManager <|-- NativeTokenStakingManager
