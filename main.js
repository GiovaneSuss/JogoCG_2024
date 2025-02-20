function main() {
  let targetX = 0.0; // Posição alvo do cubo
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

  if (!gl) {
    throw new Error('WebGL não suportado');
  }

  // Compila shaders
  const vertexShaderSource = document.querySelector("#vertex-shader").text;
  const fragmentShaderSource = document.querySelector("#fragment-shader").text;
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(program);

  // Ativa depth-test
  gl.enable(gl.DEPTH_TEST);

  // --- Localizações de atributo ---
  const positionLoc = gl.getAttribLocation(program, "position");
  const colorLoc = gl.getAttribLocation(program, "color");
  const normalLoc = gl.getAttribLocation(program, "normal");

  // --- Localizações de uniform ---
  const uMVP_Location = gl.getUniformLocation(program, "uMVP");
  const uModelMatrix_Location = gl.getUniformLocation(program, "uModelMatrix");
  const uLightPos_Location = gl.getUniformLocation(program, "uLightPosition");
  const uViewPos_Location = gl.getUniformLocation(program, "uViewPosition");
  const uShininess_Location = gl.getUniformLocation(program, "uShininess");

  // Configura luz e câmera
  // Posição da luz no espaço de mundo
  // "Olho" do observador = mesma da câmera
  let cameraPos = [0.3, 1.5, 5.0];
  gl.uniform3fv(uLightPos_Location, [0.0, 5.0, 5.0]);
  // Brilho especular
  gl.uniform1f(uShininess_Location, 50.0);

  // --- Buffers (GENÉRICOS) ---
  // Em vez de um único par de buffers, teremos 3 pares: para "pos", "col", "normal".
  // Mas vamos criar as funções "createBuffer" para facilitar.

  function createBuffer(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  }

  // Função que faz o binding de atributo
  function bindAttrib(buffer, attribLocation, numComponents) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribLocation);
    gl.vertexAttribPointer(
      attribLocation,
      numComponents,   // ex: 3 para (x,y,z)
      gl.FLOAT,
      false,
      0,
      0
    );
  }

  // === 1) Dados do CUBO ===
  let cubePositions = setCubeVertices();
  let cubeColors = setCubeColors();
  let cubeNormals = setCubeNormals();

  // Cria buffers do cubo
  const cubePosBuffer = createBuffer(cubePositions);
  const cubeColBuffer = createBuffer(cubeColors);
  const cubeNorBuffer = createBuffer(cubeNormals);

  const cubeNumVerts = cubePositions.length / 3; // quantos vértices?

  // Defina um offset vertical para mover os objetos para baixo
  const verticalOffset = -2.0;

  // === 2) Dados do CHÃO ===
  // Atualize as posições do chão para que comecem mais embaixo
  let floorPositions = [
    -3.0, verticalOffset, 1.0,
    0.0, verticalOffset, 1.0,
    0.0, verticalOffset, -30.0,

    3.0, verticalOffset, 1.0,
    0.0, verticalOffset, 1.0,
    0.0, verticalOffset, -30.0,
  ];
  // Cores do chão (6 vértices)
  let floorColors = [
    // mesmo que antes, ou tome outra cor
    1.0, 0.55, 0.0,
    1.0, 0.65, 0.31,
    0.96, 0.87, 0.70,

    1.0, 0.55, 0.0,
    1.0, 0.65, 0.31,
    0.96, 0.87, 0.70,
  ];
  // Normais do chão (apontando para cima no eixo Y, pois é um plano "horizontal"):
  // * CUIDADO se o triângulo está "deitado" ou "em pé". Aqui assumimos normal +Y.
  let floorNormals = [
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0,
  ];

  const floorPosBuffer = createBuffer(floorPositions);
  const floorColBuffer = createBuffer(floorColors);
  const floorNorBuffer = createBuffer(floorNormals);
  const floorNumVerts = floorPositions.length / 3;

  // === 3) Obstáculos (triângulos) ===
  // Você cria e recria muita geometria no código (movendo etc.).
  // Aqui simplificaremos: um “triângulo base” com normal. 
  // Depois escalamos/rotacionamos via matriz.
  // Ex: triângulo no plano XZ com normal (0,1,0) ou algo do tipo.

  // Triângulo (duas vezes => 6 vértices) => um retângulo em shape de trapézio
  // Mas vamos simplificar só para exibir a ideia
  let obstacleBasePositions = [
    // Base face
    0.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    0.5, 0.0, 1.0,

    // Side face 1
    0.0, 0.0, 0.0,
    0.5, 1.0, 0.5,
    1.0, 0.0, 0.0,

    // Side face 2
    1.0, 0.0, 0.0,
    0.5, 1.0, 0.5,
    0.5, 0.0, 1.0,

    // Side face 3
    0.5, 0.0, 1.0,
    0.5, 1.0, 0.5,
    0.0, 0.0, 0.0,
  ];

  // gerar normais face por face
  let obstacleBaseNormals = [
    // Base face (0,-1,0)
    0, -1, 0, 0, -1, 0, 0, -1, 0,

    // Side face 1 (0.5, 0.5, -0.5)
    0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5,

    // Side face 2 (0.5, 0.5, 0.5)
    0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,

    // Side face 3 (-0.5, 0.5, 0.5)
    -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ];

  // Define as cores-base para os obstáculos (12 vértices = 4 triângulos * 3 vértices)
  let obstacleBaseColors = [];
  for (let i = 0; i < 12; i++) {
    // cor padrão branca ou qualquer cor uniforme
    obstacleBaseColors.push(1.0, 1.0, 1.0);
  }

  const obstaclePosBufferBase = createBuffer(obstacleBasePositions);
  const obstacleColBufferBase = createBuffer(obstacleBaseColors);
  const obstacleNorBufferBase = createBuffer(obstacleBaseNormals);
  const obstacleNumVerts = obstacleBasePositions.length / 3;

  let obstacles = [];
  function createObstacle() {
    const possiblePositionsX = [-2, 0, 1.5];
    let lane = possiblePositionsX[Math.floor(Math.random() * possiblePositionsX.length)];
    let targetX = lane * 1.5;  // Define a lane de destino
    let r = Math.random();
    let g = Math.random();
    let b = Math.random();

    obstacles.push({
      color: [r, g, b],
      x: 0,         // Sempre começa em 0
      targetX: targetX,
      z: -25        // Ponto inicial em z
    });
  }

  // Cria 2 obstáculos iniciais
  for (let i = 0; i < 2; i++) {
    createObstacle();
  }

  // --- Interação para mover cubo ---
  let cubePositionX = 0.0;
  const possibleX = [-2, 0, 2];
  let currentIndex = 1;

  let smoothCubePositionX = 0.0;  // Posição suavizada do cubo
  const lerpFactor = 0.15; // Quanto menor, mais suave será a transição

  let cameraAlternate = false;

  window.addEventListener('keydown', (event) => {
    // câmera muda, movimentação muda
    if (cameraAlternate) {
      if (event.key === 'ArrowUp' && currentIndex > 0) {
        currentIndex--;
      } else if (event.key === 'ArrowDown' && currentIndex < possibleX.length - 1) {
        currentIndex++;
      }
    } else {
      if (event.key === 'ArrowLeft' && currentIndex > 0) {
        currentIndex--;
      } else if (event.key === 'ArrowRight' && currentIndex < possibleX.length - 1) {
        currentIndex++;
      }
    }
    targetX = possibleX[currentIndex];

    // "P" alterna pausa
    if (event.key.toLowerCase() === 'p') {
      paused = !paused;
    }
  });

  let score = 0;
  let gameOver = false;

  function checkCollision(obstacle) {
    let cubeSize = 0.5, obstacleSize = 0.5;
    let zThreshold = 1.0;
    let xCollision = Math.abs(smoothCubePositionX - obstacle.x) < (cubeSize + obstacleSize);
    let zCollision = Math.abs(obstacle.z - 0) < zThreshold;
    return (xCollision && zCollision);
  }

  // --- Matrizes de projeção e view ---
  let xw_min = -4, xw_max = 4, yw_min = -4, yw_max = 4;
  let z_near = -1, z_far = -10000;
  let orthoMatrix = ortographicProjection(xw_min, xw_max, yw_min, yw_max, z_near, z_far);

  // Câmera
  let P_ref = [0, 1, 1], V = [0, 1, 0];
  let viewMatrix = set3dViewingMatrix(cameraPos, P_ref, V);

  // Cria um div na tela para exibir "PAUSADO"
  const pauseElement = document.createElement("div");
  pauseElement.id = "pause-message";
  pauseElement.textContent = "PAUSADO";
  pauseElement.style.position = "absolute";
  pauseElement.style.top = "50%";
  pauseElement.style.left = "50%";
  pauseElement.style.transform = "translate(-50%, -50%)";
  pauseElement.style.color = "white";
  pauseElement.style.fontSize = "48px";
  pauseElement.style.fontWeight = "bold";
  pauseElement.style.display = "none";
  document.body.appendChild(pauseElement);

  // Função de desenho principal
  function drawScene() {
    // recalcula viewmatrix
    viewMatrix = set3dViewingMatrix(cameraPos, P_ref, V);

    // mantém o loop pra não ter que recalcular a matriz de projeção
    // nem precisar reiniciar o ciclo de animações do zero
    if (paused) {
      pauseElement.style.display = "block";
      requestAnimationFrame(drawScene);
      return;
    } else {
      pauseElement.style.display = "none";
    }

    if (gameOver) return;

    // Atualiza pontuação
    score += 0.015;
    if (score >= 60) {
      gameOver = true;
      setTimeout(() => {
        alert("Parabéns! Você venceu!");
        location.reload();
      }, 100);
      return;
    }
    
    // Muda a câmera automaticamente quando score > 30
    if (score > 30) {
      cameraAlternate = true;
      cameraPos = [5.0, 1.5, 0.3];
    } else {
      cameraAlternate = false;
      cameraPos = [0.3, 1.5, 5.0];
    }

    // Limpa tela
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Monta a "viewProjection" = proj * view
    let viewProj = m4.multiply(orthoMatrix, viewMatrix);

    // == 1) Desenhar o CHÃO ==
    // ModelMatrix para o chão = identidade
    let floorModel = m4.identity();
    // MVP
    let floorMVP = m4.multiply(viewProj, floorModel);

    // Envia pro shader
    gl.uniformMatrix4fv(uMVP_Location, false, new Float32Array(floorMVP));
    gl.uniformMatrix4fv(uModelMatrix_Location, false, new Float32Array(floorModel));

    // Faz bind dos buffers
    bindAttrib(floorPosBuffer, positionLoc, 3);
    bindAttrib(floorColBuffer, colorLoc, 3);
    bindAttrib(floorNorBuffer, normalLoc, 3);

    // Desenha
    gl.drawArrays(gl.TRIANGLES, 0, floorNumVerts);

    // == 2) Desenhar o CUBO ==
    // Montar modelMatrix do cubo
    let cubeModel = m4.identity();
    // Translada no eixo X e aplica o offset vertical
    smoothCubePositionX += (targetX - smoothCubePositionX) * lerpFactor;
    cubeModel = m4.translate(cubeModel, smoothCubePositionX, verticalOffset + 0.5, 0.0);

    let cubeMVP = m4.multiply(viewProj, cubeModel);

    gl.uniformMatrix4fv(uMVP_Location, false, new Float32Array(cubeMVP));
    gl.uniformMatrix4fv(uModelMatrix_Location, false, new Float32Array(cubeModel));

    // Buffers do cubo
    bindAttrib(cubePosBuffer, positionLoc, 3);
    bindAttrib(cubeColBuffer, colorLoc, 3);
    bindAttrib(cubeNorBuffer, normalLoc, 3);
    gl.drawArrays(gl.TRIANGLES, 0, cubeNumVerts);

    // == 3) Desenhar OBSTÁCULOS ==
    obstacles.forEach((obs, index) => {
      obs.z += 0.1;  // avança em Z

      // colisão?
      if (checkCollision(obs)) {
        gameOver = true;
        setTimeout(() => {
          alert("Game Over! Score: " + Math.floor(score));
          location.reload();
        }, 100);
      }

      let minZ = -25, maxZ = 0;
      let scaleFactor = (obs.z - minZ) / (maxZ - minZ);

      // Calcula a progressão com base no deslocamento de z
      let progress = (obs.z + 25) / 30; // z varia de -25 a 5
      obs.x = progress * obs.targetX;

      // Remove obstáculo e cria outro
      if (obs.z > 2) {
        obstacles.splice(index, 1);
        createObstacle();
      } else {
        let obsModel = m4.identity();
        // Translada também no eixo Y usando verticalOffset
        obsModel = m4.translate(obsModel, obs.x, verticalOffset, obs.z);
        obsModel = m4.scale(obsModel, scaleFactor, scaleFactor, scaleFactor);

        let obsMVP = m4.multiply(viewProj, obsModel);

        gl.uniformMatrix4fv(uMVP_Location, false, new Float32Array(obsMVP));
        gl.uniformMatrix4fv(uModelMatrix_Location, false, new Float32Array(obsModel));

        // Cria buffer de cores para todos os 36 vértices
        let c = [];
        for (let i = 0; i < obstacleNumVerts; i++) {
          c.push(obs.color[0], obs.color[1], obs.color[2]);
        }
        // Sobrescreve o buffer de cor base para este obstáculo
        gl.bindBuffer(gl.ARRAY_BUFFER, obstacleColBufferBase);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c), gl.STATIC_DRAW);

        // Faz bind dos atributos
        bindAttrib(obstaclePosBufferBase, positionLoc, 3);
        bindAttrib(obstacleColBufferBase, colorLoc, 3);
        bindAttrib(obstacleNorBufferBase, normalLoc, 3);

        // Desenha
        gl.drawArrays(gl.TRIANGLES, 0, obstacleNumVerts);
      }
    });

    // Atualiza pontuação na tela
    const scoreElement = document.getElementById("score");
    if (scoreElement) {
      scoreElement.textContent = "Pontuação: " + Math.floor(score);
    }

    requestAnimationFrame(drawScene);
  }

  drawScene();
}

// instruções de início
alert(
  "Comandos do jogo:\n" +
  " - Use as setas para se mover.\n" +
  " - Tecla 'P' pausa/retoma o jogo.\n" +
  " - Evite colidir com os obstáculos e fique atento!\n" +
  " - Quando atingir 30 pontos, prepare-se para uma surpresa!\n" +
  " - Chegue a 60 pontos para vencer!!!\n" +
  "Boa sorte!"
);

let paused = false;

function setCubeNormals() {
  // gerar normais face por face
  const norms = [];

  // Front face (0,0,1) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(0, 0, 1);
  }
  // Left face (-1,0,0) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(-1, 0, 0);
  }
  // Back face (0,0,-1) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(0, 0, -1);
  }
  // Right face (1,0,0) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(1, 0, 0);
  }
  // Top face (0,1,0) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(0, 1, 0);
  }
  // Bottom face (0,-1,0) - 6 vértices
  for (let i = 0; i < 6; i++) {
    norms.push(0, -1, 0);
  }

  return norms;
}

function setCubeVertices() {
  const vertexData = [
    // Cubo principal (rosto)
    // Front face
    0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,
    -0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,
    -0.5, -0.5, 0.5,

    // Left face
    -0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5,
    -0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5,

    // Back face
    -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,

    // Right face
    0.5, 0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, 0.5,
    0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, -0.5, -0.5,

    // Top face
    0.5, 0.5, 0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,

    // Bottom face
    0.5, -0.5, 0.5,
    0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5,
    -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5,
    -0.5, -0.5, -0.5,

    // Olho esquerdo (um pequeno cubo)
    -0.3, 0.3, 0.51,
    -0.1, 0.3, 0.51,
    -0.3, 0.1, 0.51,
    -0.3, 0.1, 0.51,
    -0.1, 0.3, 0.51,
    -0.1, 0.1, 0.51,

    // Olho direito (um pequeno cubo)
    0.1, 0.3, 0.51,
    0.3, 0.3, 0.51,
    0.1, 0.1, 0.51,
    0.1, 0.1, 0.51,
    0.3, 0.3, 0.51,
    0.3, 0.1, 0.51,

    // Boca (um retângulo)
    -0.3, -0.3, 0.51,
    0.3, -0.3, 0.51,
    -0.3, -0.5, 0.51,
    -0.3, -0.5, 0.51,
    0.3, -0.3, 0.51,
    0.3, -0.5, 0.51,

    // Nariz (um triângulo)
    0.0, 0.0, 0.51,
    -0.1, -0.2, 0.51,
    0.1, -0.2, 0.51,

    // Turbante (um retângulo curvado acima do cubo)
    // Parte frontal do turbante
    -0.6, 0.6, 0.5,
    0.6, 0.6, 0.5,
    -0.6, 0.5, 0.5,
    -0.6, 0.5, 0.5,
    0.6, 0.6, 0.5,
    0.6, 0.5, 0.5,

    // Parte traseira do turbante
    -0.6, 0.6, -0.5,
    0.6, 0.6, -0.5,
    -0.6, 0.5, -0.5,
    -0.6, 0.5, -0.5,
    0.6, 0.6, -0.5,
    0.6, 0.5, -0.5,

    // Lado esquerdo do turbante
    -0.6, 0.6, 0.5,
    -0.6, 0.6, -0.5,
    -0.6, 0.5, 0.5,
    -0.6, 0.5, 0.5,
    -0.6, 0.6, -0.5,
    -0.6, 0.5, -0.5,

    // Lado direito do turbante
    0.6, 0.6, 0.5,
    0.6, 0.6, -0.5,
    0.6, 0.5, 0.5,
    0.6, 0.5, 0.5,
    0.6, 0.6, -0.5,
    0.6, 0.5, -0.5,

    // Topo do turbante
    -0.6, 0.6, 0.5,
    0.6, 0.6, 0.5,
    -0.6, 0.6, -0.5,
    -0.6, 0.6, -0.5,
    0.6, 0.6, 0.5,
    0.6, 0.6, -0.5,

  ];
  return vertexData;
}

function setCubeColors() {
  const colorData = [];

  // Cores para o cubo principal (rosto)
  const faceColor = [1.0, 0.8, 0.6]; // Cor de pele
  for (let i = 0; i < 36; i++) {
    colorData.push(...faceColor);
  }

  // Cores para os olhos
  const eyeColor = [0.0, 0.0, 0.0]; // Preto
  for (let i = 0; i < 12; i++) {
    colorData.push(...eyeColor);
  }

  // Cores para a boca
  const mouthColor = [1.0, 0.0, 0.0]; // Vermelho
  for (let i = 0; i < 6; i++) {
    colorData.push(...mouthColor);
  }

  // Cores para o nariz
  const noseColor = [1.0, 0.5, 0.0]; // Laranja
  for (let i = 0; i < 3; i++) {
    colorData.push(...noseColor);
  }

  // Cores para o turbante (azul, por exemplo)
  const turbanColor = [0.0, 0.0, 1.0]; // Azul
  for (let i = 0; i < 30; i++) { // 30 vértices para o turbante
    colorData.push(...turbanColor);
  }

  return colorData;
}

function set3dViewingMatrix(P0, P_ref, V) {
  let matrix = [];
  let N = [
    P0[0] - P_ref[0],
    P0[1] - P_ref[1],
    P0[2] - P_ref[2],
  ];
  let n = unitVector(N);
  let u = unitVector(crossProduct(V, n));
  let v = crossProduct(n, u);

  let T = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -P0[0], -P0[1], -P0[2], 1,
  ];
  let R = [
    u[0], v[0], n[0], 0,
    u[1], v[1], n[1], 0,
    u[2], v[2], n[2], 0,
    0, 0, 0, 1,
  ];

  matrix = m4.multiply(R, T);
  return matrix;
}

function ortographicProjection(xw_min, xw_max, yw_min, yw_max, z_near, z_far) {
  let matrix = [
    2 / (xw_max - xw_min), 0, 0, 0,
    0, 2 / (yw_max - yw_min), 0, 0,
    0, 0, -2 / (z_near - z_far), 0,
    -(xw_max + xw_min) / (xw_max - xw_min), -(yw_max + yw_min) / (yw_max - yw_min), (z_near + z_far) / (z_near - z_far), 1,
  ];
  return matrix;
}

function crossProduct(v1, v2) {
  let result = [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0]
  ];
  return result;
}

function unitVector(v) {
  let result = [];
  let vModulus = vectorModulus(v);
  return v.map(function (x) { return x / vModulus; });
}

function vectorModulus(v) {
  return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2) + Math.pow(v[2], 2));
}


function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

var m4 = {
  identity: function () {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  },

  multiply: function (a, b) {
    var a00 = a[0 * 4 + 0];
    var a01 = a[0 * 4 + 1];
    var a02 = a[0 * 4 + 2];
    var a03 = a[0 * 4 + 3];
    var a10 = a[1 * 4 + 0];
    var a11 = a[1 * 4 + 1];
    var a12 = a[1 * 4 + 2];
    var a13 = a[1 * 4 + 3];
    var a20 = a[2 * 4 + 0];
    var a21 = a[2 * 4 + 1];
    var a22 = a[2 * 4 + 2];
    var a23 = a[2 * 4 + 3];
    var a30 = a[3 * 4 + 0];
    var a31 = a[3 * 4 + 1];
    var a32 = a[3 * 4 + 2];
    var a33 = a[3 * 4 + 3];
    var b00 = b[0 * 4 + 0];
    var b01 = b[0 * 4 + 1];
    var b02 = b[0 * 4 + 2];
    var b03 = b[0 * 4 + 3];
    var b10 = b[1 * 4 + 0];
    var b11 = b[1 * 4 + 1];
    var b12 = b[1 * 4 + 2];
    var b13 = b[1 * 4 + 3];
    var b20 = b[2 * 4 + 0];
    var b21 = b[2 * 4 + 1];
    var b22 = b[2 * 4 + 2];
    var b23 = b[2 * 4 + 3];
    var b30 = b[3 * 4 + 0];
    var b31 = b[3 * 4 + 1];
    var b32 = b[3 * 4 + 2];
    var b33 = b[3 * 4 + 3];
    return [
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
    ];
  },

  translation: function (tx, ty, tz) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ];
  },

  xRotation: function (angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ];
  },

  yRotation: function (angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ];
  },

  zRotation: function (angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  },

  scaling: function (sx, sy, sz) {
    return [
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ];
  },

  translate: function (m, tx, ty, tz) {
    return m4.multiply(m, m4.translation(tx, ty, tz));
  },

  xRotate: function (m, angleInRadians) {
    return m4.multiply(m, m4.xRotation(angleInRadians));
  },

  yRotate: function (m, angleInRadians) {
    return m4.multiply(m, m4.yRotation(angleInRadians));
  },

  zRotate: function (m, angleInRadians) {
    return m4.multiply(m, m4.zRotation(angleInRadians));
  },

  scale: function (m, sx, sy, sz) {
    return m4.multiply(m, m4.scaling(sx, sy, sz));
  },

};

function radToDeg(r) {
  return r * 180 / Math.PI;
}

function degToRad(d) {
  return d * Math.PI / 180;
}

main();