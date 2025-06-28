import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

const EVENTS_COLLECTION = "events";

export const saveEventToFirestore = async (event) => {
  try {
    const eventData = {
      title: event.title || "",
      start: event.start instanceof Date ? event.start : new Date(event.start),
      end: event.end instanceof Date ? event.end : new Date(event.end),
      tags: event.tags || [],
      notes: event.notes || "",
      color: event.color?.value || "",
      border: event.color?.border || "",
      name: event.color?.name || ""
    };

    if (event.id) {
      const docRef = doc(db, EVENTS_COLLECTION, event.id);
      await setDoc(docRef, eventData, { merge: true });
    } else {
      const newDocRef = doc(collection(db, EVENTS_COLLECTION));
      await setDoc(newDocRef, eventData);
    }

    console.log("Event saved:", event.title);
  } catch (e) {
    console.error("Error saving event:", e);
  }
};

export const loadEventsFromFirestore = async () => {
  const snapshot = await getDocs(collection(db, EVENTS_COLLECTION));
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    
    // カラーオブジェクトを再構築
    const colorObject = {
      name: data.name || 'ブルー',
      value: data.color || 'bg-blue-500',
      border: data.border || 'border-blue-500'
    };
    
    return {
      id: doc.id,
      title: data.title,
      start: data.start.toDate ? data.start.toDate() : new Date(data.start),
      end: data.end.toDate ? data.end.toDate() : new Date(data.end),
      tags: data.tags || [],
      notes: data.notes || "",
      color: colorObject, // ← オブジェクトとして復元
    };
  });
};

export const deleteEventFromFirestore = async (eventId) => {
  try {
    const docRef = doc(db, EVENTS_COLLECTION, eventId);
    await deleteDoc(docRef);
    console.log("Event deleted:", eventId);
  } catch (e) {
    console.error("Error deleting event:", e);
  }
};