import Whatsapp from "../../models/Whatsapp";
import WhatsappQueue from "../../models/WhatsappQueue";
import { queuePositions } from "../../helpers/WhatsappQueueMenu";

// queueIds come in the order chosen for the bot menu of the channel.
const AssociateWhatsappQueue = async (
  whatsapp: Whatsapp,
  queueIds: number[]
): Promise<void> => {
  const positions = queuePositions(queueIds);

  await whatsapp.$set(
    "queues",
    positions.map(({ queueId }) => queueId)
  );

  await Promise.all(
    positions.map(({ queueId, position }) =>
      WhatsappQueue.update(
        { position },
        { where: { whatsappId: whatsapp.id, queueId } }
      )
    )
  );

  await whatsapp.reload();
};

export default AssociateWhatsappQueue;
