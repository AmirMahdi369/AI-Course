// =============================
//  Load Face-API Models
// =============================
Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models'),
  faceapi.nets.ageGenderNet.loadFromUri('/models'),
]).then(startVideo);


// =============================
//  Start Webcam
// =============================
function startVideo() {
  const video = document.getElementById('video');

  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => { video.srcObject = stream })
    .catch(err => console.error(err));

  // ensure we start when metadata (dimensions) are ready
  video.addEventListener('loadedmetadata', () => {
    // set the element's internal width/height to the real camera size
    video.width = video.videoWidth;
    video.height = video.videoHeight;

    // now start recognition
    recognizeFaces(video);
  }, { once: true });
}


// =============================
//  Load Images From API
// =============================
// =============================
//  Load Images From API (FIXED)
// =============================
async function loadLabeledImages() {
  const response = await fetch('/api/images');
  const files = await response.json();

  const descriptors = [];

  for (const file of files) {
    const label = file.split('.')[0];
    const imgUrl = `/images/${file}`;
    const img = await faceapi.fetchImage(imgUrl);

    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn(`❗ No face detected in ${file} — skipping.`);
      continue; // prevents crash
    }

    descriptors.push(
      new faceapi.LabeledFaceDescriptors(label, [detection.descriptor])
    );
  }

  return descriptors;
}



// =============================
//  Helpers: sync canvas <-> video
// =============================
function syncCanvasToVideo(video, canvas) {
  // Set drawing buffer to actual camera resolution
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Set visible size to the displayed size of the video element
  canvas.style.width = `${video.offsetWidth}px`;
  canvas.style.height = `${video.offsetHeight}px`;

  // Position canvas at top-left inside the wrapper
  canvas.style.position = 'absolute';
  canvas.style.left = '0px';
  canvas.style.top = '0px';
  canvas.style.pointerEvents = 'none';

  // If video is mirrored with CSS transform, copy that transform to the canvas
  const vStyle = window.getComputedStyle(video);
  const transform = vStyle.transform || vStyle.webkitTransform;
  if (transform && transform !== 'none') {
    canvas.style.transform = transform;
    // Ensure transform origin matches
    canvas.style.transformOrigin = 'center center';
  } else {
    canvas.style.transform = '';
  }
}


// =============================
//  MAIN RECOGNITION LOOP
// =============================
async function recognizeFaces(video) {
  // use the existing overlay canvas in your HTML
  const canvas = document.getElementById('overlay');
  if (!canvas) {
    console.error('No canvas element with id "overlay" found in DOM.');
    return;
  }

  // make sure the canvas is inside the same positioned wrapper and sits on top
  // (your HTML already has .wrapper { position: relative } so canvas absolute will align)
  syncCanvasToVideo(video, canvas);

  // handle window resize (responsive)
  window.addEventListener('resize', () => syncCanvasToVideo(video, canvas));

  // prepare face-api sizing
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  // load labeled faces
  const labeledDescriptors = await loadLabeledImages();
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.60);

  const ctx = canvas.getContext('2d');

  // main draw loop
  async function frame() {
    // detect
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors()
      .withFaceExpressions()
      .withAgeAndGender();

    // resize detections to the same coordinate space as displaySize
    const resized = faceapi.resizeResults(detections, displaySize);

    // clear canvas drawing buffer (actual pixel size)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw each detection
    resized.forEach(det => {
      const match = faceMatcher.findBestMatch(det.descriptor);
      const box = det.detection.box;

      const age = det.age ? Math.round(det.age) : '?';
      const gender = det.gender || '?';
      const emotion = det.expressions
        ? Object.entries(det.expressions).sort((a, b) => b[1] - a[1])[0][0]
        : '?';

      // draw box+label
      new faceapi.draw.DrawBox(box, {
        label: `${match.toString()} | Age:${age} | Gender:${gender} | Mood:${emotion}`,
        boxColor: '#1e90ff',
        lineWidth: 2
      }).draw(canvas);

      // draw landmarks for this detection (pass the single resized det)
      faceapi.draw.drawFaceLandmarks(canvas, [det]);
    });

    requestAnimationFrame(frame);
  }

  frame();
}
