const { run }= require('hardhat')

const verify = async (contractAddress, args, libraries) => {
    console.log("Verifying contract...")
    try {
        const verificationArgs = {
            address: contractAddress,
            constructorArguments: args
        }
        if(libraries) {
            verificationArgs.libraries = libraries
        }

        await run("verify:verify", verificationArgs)
    } catch (e) {
        if(e.message.toLowerCase().includes("already verified")){
            console.log("already verified")
        } else {
            console.log("Verification failed: ", e)
        }
    }
}

module.exports = verify