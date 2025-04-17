export default function WhatsNext() {
    return <div className="space-y-12">
        <div>
            <h1 className="text-2xl font-medium mb-4">What's Next?</h1>
            <p>Cograts! You've set up your L1. We would love to learn how you've liked the experience and how we can make it event smoother. Please provide feedback in our Telegram group using the button above.</p>
        </div>
        <div>
            <h3 className="mb-4 font-medium">Next Steps:</h3>
            <ul className="list-disc list-inside">
                <li>Deploy Interchain Messaging using our ICM Deployment tool (coming soon).</li>
                <li>Deploy a Interchain Token Transfer (ICTT) bridge using our ICTT Deployment tool (coming soon).</li>
                <li>Set up monitoring for you validators and RPC nodes (coming soon).</li>
            </ul>
        </div>
    </div>;
}
