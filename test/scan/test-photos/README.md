# Real-photo test data

Photos of a real cube in real light, for checking how well the app names colours (`test/scan/photos.test.ts`). The files are the colours the camera read, not pictures.

## Adding some

1. Run the app on your phone (`npm run dev:phone`) and open it with `?scan-debug` on the end of the address, e.g. `https://192.168.…:5174/?scan-debug`. Then pick the cube; for a 2x2 you can also go straight to `…/?scan-debug#/2x2`. Each scan records which cube it was.
2. Tap **Scan**. A dashed debug bar appears under the instructions. Pick the **Light** you're in: daylight, warm bulb, dim, phone torch or other.
3. Scan all six sides. Fix every wrong square by tapping it and picking the right colour: what you end up with is taken as the right answer.
4. Repeat in other light. About 20 sides spread over daylight, warm bulbs, dim light and the phone torch is a good start.
5. Tap **Download** (or **Copy** and paste into a file), and save the file here as `something.json`.

`npm test` then checks every square in these files. The test is skipped while this folder has no `.json` files.
