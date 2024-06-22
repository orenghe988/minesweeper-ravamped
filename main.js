// TODO add maybeOffViewportEvent() function
// TODO add #offViewportEvent colored light

// TODO show other mines on game over
// TODO add fences mode
// TODO add unstable mines mode
// TODO add custom board sizes
// TODO add stats page
// TODO better mine explosions and implosions
// TODO add confirmation query on #go-back-btn, #restart-game-btn

(function () {
  // handling ->

  let board;

  //   initialize board and event listeners
  function init() {
    //TODO check for gameProgress in localstorage
    board = document.getElementById("board");
    board.setAttribute("class", "startboard");
    // <element>.querySelector(selector) selects the first element which is a child of <element> and matches css selector selector
    //TODO check for preference cookie
    document
      .querySelector(
        '.difficulty-selectors > input[type="radio"][name="difficulty-selector-radio"][value="10"]'
      )
      .setAttribute("checked", true);

    // <element>.querySelector(selector) selects all elements which are children of <element> and match css selector selector
    // for-of allows selecting an array's element in every iteration as opposed to an index
    for (let radio of document.querySelectorAll(
      '.difficulty-selectors > input[type="radio"][name="difficulty-selector-radio"]'
    )) {
      // add an event listener
      radio.addEventListener("click", ({ target }) => {
        document.documentElement.style.setProperty(
          "--game-difficulty",
          target.value
        );
      });
    }

    //temp
    document.getElementById("stats-btn").setAttribute("disabled", true);

    //temp
    document
      .getElementById("fence-mode-selector")
      .setAttribute("disabled", true);
    //temp
    document
      .getElementById("unstable-mines-mode-selector")
      .setAttribute("disabled", true);

    disableDependOnCheckbox(
      document.getElementById("fence-mode-selector"),
      document.getElementById("unstable-mines-mode-selector")
    );

    let helpModal = document.getElementById("help-modal");
    useModalAnimatedClose(helpModal);
    document
      .getElementById("help-icon")
      .addEventListener("click", () => helpModal.showModal());

    document
      .getElementById("restart-game-btn")
      .addEventListener("click", restartGame);

    document
      .getElementById("go-back-btn")
      .addEventListener("click", () => location.reload());

    document
      .getElementById("new-game-btn")
      .addEventListener("click", () => startNewGame(board));
  }

  //   dependant will disable and revert to unchecked as checkbox disables
  function disableDependOnCheckbox(checkbox, dependant) {
    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) {
        dependant.removeAttribute("disabled");
      } else {
        dependant.setAttribute("disabled", true);
        dependant.checked = false;
      }
    });
  }

  //   close modal with animation
  function modalAnimatedClose(modal) {
    modal.setAttribute("closing", "");

    modal.addEventListener(
      "animationend",
      ({ target }) => {
        target.removeAttribute("closing");
        // close a dialog element
        target.close();
      },
      { once: true }
    );
  }

  //   add event listener to modal close button
  function useModalAnimatedClose(modal) {
    let modalCloseButton = document.getElementById(
      `${modal.getAttribute("id")}-close-btn`
    );
    if (modalCloseButton) {
      modalCloseButton.addEventListener("click", () =>
        modalAnimatedClose(modal)
      );
    }
  }

  //   set counter value
  function setCounterValue(counter, value) {
    let nv = value;
    if (nv < 0) {
      // throw an error to be displayed on the console, and terminate execution
      throw new Error("negative value");
    }
    let counterDigits = counter.querySelectorAll(".counter-digit");
    if (counterDigits.length === 0) {
      throw new Error(
        'no digits (with class ".counter-digit") detected in counter.'
      );
    }
    let counterMax = Math.pow(10, counterDigits.length) - 1;
    if (nv > counterMax) {
      throw new Error("value does not fit counter.");
    }
    for (let i = counterDigits.length - 1; i >= 0; i--) {
      //   counterDigits[i].innerHTML = Math.floor(nv % 10);
      let iv = parseInt(counterDigits[i].innerHTML);
      let ev = Math.floor(nv % 10);
      if (ev > iv) {
        for (let j = iv; j < ev; j++) {
          transformDigitUp(counterDigits[i]);
        }
      } else {
        for (let j = iv; j > ev; j--) {
          transformDigitDown(counterDigits[i]);
        }
      }
      nv /= 10;
    }
  }

  //   increment a counter's digit and apply appropriate animation
  function transformDigitUp(digitElement) {
    // <element>.classList allows access to methods regarding <element>'s class property
    digitElement.classList.add("exitTopViewWindowBoundary");
    digitElement.addEventListener(
      "animationend",
      () => {
        digitElement.innerHTML++;
        digitElement.classList.add("enterBottomViewWindowBoundary");
        digitElement.classList.remove("exitTopViewWindowBoundary");

        digitElement.addEventListener(
          "animationend",
          () => {
            digitElement.classList.remove("enterBottomViewWindowBoundary");
          },
          { once: true }
        );
      },
      { once: true }
    );
  }

  //   decrement a counter's digit and apply appropriate animation
  function transformDigitDown(digitElement) {
    digitElement.classList.add("exitBottomViewWindowBoundary");
    digitElement.addEventListener(
      "animationend",
      () => {
        digitElement.innerHTML--;
        digitElement.classList.add("enterTopViewWindowBoundary");
        digitElement.classList.remove("exitBottomViewWindowBoundary");

        digitElement.addEventListener(
          "animationend",
          () => {
            digitElement.classList.remove("enterTopViewWindowBoundary");
          },
          { once: true }
        );
      },
      { once: true }
    );
  }

  //   transform square coordinations into string
  function squareCoordsToString(squareX, squareY) {
    return squareX + "-" + squareY;
  }

  // <- handling

  /////////////////////////////////////////////////////////////////////////////////////////////

  // game ->

  let squareMap = {};
  let initialClickOccurred = false;
  let flagsRemaining = 0;
  let timeElapsed = 0;
  let acceptingClicks = true;
  let preferences = {};
  let pressedSquareCount = 0;
  let timerInterval;

  //   retrieve game preferences
  function getGamePreferences(board) {
    let difficulty = board.querySelector(
      '.difficulty-selectors > input[type="radio"][name="difficulty-selector-radio"]:checked'
    ).value;
    let boardNSquares = difficulty * difficulty;
    let fencesModeToggle = document.getElementById(
      "fence-mode-selector"
    ).checked;
    //prettier-ignore
    let unstableMinesModeToggle = document.getElementById("unstable-mines-mode-selector").checked;
    let mineAmount = 5 * difficulty - 40;

    return {
      difficulty,
      mineAmount,
      boardNSquares,
      fencesModeToggle: true,
      unstableMinesModeToggle,
    };
  }

  //   start a new game
  function startNewGame(board, pref) {
    // ?? returns left operand unless it is undefined or null, then it returns the right operand
    preferences = pref ?? getGamePreferences(board);

    for (let i = 0; i < preferences.boardNSquares; i++) {
      let squareX = i % preferences.difficulty;
      let squareY = Math.floor(i / preferences.difficulty);

      let square = document.createElement("button");
      square.setAttribute("class", "square animate-in");
      square.setAttribute("square-coord-x", squareX);
      square.setAttribute("square-coord-y", squareY);
      square.addEventListener(
        "animationend",
        ({ target }) => {
          target.classList.remove("animate-in");
        },
        { once: true }
      );

      square.addEventListener("contextmenu", handleSquareRightClick);

      square.addEventListener("click", handleSquareClick);

      board.appendChild(square);
    }

    flagsRemaining = preferences.mineAmount;

    setCounterValue(
      document.getElementById("flags-remaining-counter"),
      flagsRemaining
    );

    startNewGameAnimation(board);
  }

  //   reveal a square
  function revealSquare(square) {
    square.classList.add("pressed");
    let adjacentMineCount =
      squareMap[
        squareCoordsToString(
          square.getAttribute("square-coord-x"),
          square.getAttribute("square-coord-y")
        )
      ];
    square.setAttribute("mine-count", adjacentMineCount);
    return adjacentMineCount;
  }

  // route a square click to the appropriate handler
  function handleSquareClick({ button, target }) {
    //prettier-ignore
    if (button === 0 && !target.classList.contains("marked") && acceptingClicks) {
        if (!initialClickOccurred) {
          handleInitialSquareClick({ target });
        }
        handleRegularSquareClick({ button, target });
        target.removeEventListener("click", handleSquareClick);
        target.removeEventListener("contextmenu", handleSquareRightClick);
      }
  }

  //   handle the initial click on a square - do not create a bomb on the first move's square
  function handleInitialSquareClick({ target }) {
    generateRandomMines(
      preferences.difficulty,
      preferences.mineAmount,
      squareCoordsToString(
        target.getAttribute("square-coord-x"),
        target.getAttribute("square-coord-y")
      )
    );
    traverseSquareMap();
    initialClickOccurred = true;
    timerInterval = setInterval(
      (counter) => {
        timeElapsed++;
        if (timeElapsed < 1000) {
          setCounterValue(counter, timeElapsed);
        }
      },
      1000,
      document.getElementById("time-elapsed-counter")
    );
  }

  //   handle a regular square click
  function handleRegularSquareClick({ target }) {
    let adjacentMineCount = revealSquare(target);
    if (adjacentMineCount === Infinity) {
      // explode([
      //   parseInt(target.getAttribute("square-coord-x")),
      //   parseInt(target.getAttribute("square-coord-y")),
      // ]);
      handleGameOver();
      return;
    }
    //prettier-ignore
    if (++pressedSquareCount === preferences.boardNSquares - preferences.mineAmount) {
        handleGameWon();
        return;
    }
    if (adjacentMineCount === 0) {
      let squareX = parseInt(target.getAttribute("square-coord-x"));
      let squareY = parseInt(target.getAttribute("square-coord-y"));
      let adjacentSquares = [];
      for (let ny = -1; ny <= 1; ny++) {
        for (let nx = -1; nx <= 1; nx++) {
          if (nx != 0 || ny != 0) {
            // prettier-ignore
            let newSquare = document.querySelector(
                    `.square[square-coord-x="${squareX + nx}"][square-coord-y="${squareY + ny}"]:not(.marked):not(.pressed)`
                  );
            if (newSquare) {
              revealSquare(newSquare);
              //   <array>.push(value) expands array by 1 cell and assigns value to the new cell
              adjacentSquares.push(newSquare);
            }
          }
        }
      }
      for (let newSquare of adjacentSquares) {
        newSquare.click();
      }
    }
  }

  //   handle a right click on a square and mark it with a flag
  function handleSquareRightClick(event) {
    if (event.button === 2 && acceptingClicks) {
      event.preventDefault();
      //   js will automatically convert false to 0 and true to 1
      let nv =
        event.target.classList.contains("marked") ||
        -!event.target.classList.contains("marked");
      if (flagsRemaining + nv >= 0) {
        flagsRemaining += nv;
        setCounterValue(
          document.getElementById("flags-remaining-counter"),
          flagsRemaining
        );
        event.target.classList.toggle("marked");
      }
    }
  }

  //   generate random coordinations for mines, with boundaries difficulty, amount amount and avoiding avoidCoord
  function generateRandomMines(difficulty, amount, avoidCoord) {
    let generated = [];
    while (generated.length < amount) {
      let randX = Math.floor(Math.random() * difficulty);
      let randY = Math.floor(Math.random() * difficulty);
      let randCoord = squareCoordsToString(randX, randY);
      if (!generated.includes(randCoord) && avoidCoord !== randCoord) {
        squareMap[randCoord] = Infinity;
        generated.push(randCoord);
      }
    }
  }

  //   traverse square map and number squares based on adjacent bombs
  function traverseSquareMap() {
    for (let square of document.getElementsByClassName("square")) {
      let squareX = parseInt(square.getAttribute("square-coord-x"));
      let squareY = parseInt(square.getAttribute("square-coord-y"));
      let squareCoordStr = squareCoordsToString(squareX, squareY);
      if (squareMap[squareCoordStr] !== Infinity) {
        squareMap[squareCoordStr] =
          (squareMap[`${squareX + 1}-${squareY}`] === Infinity) +
          (squareMap[`${squareX - 1}-${squareY}`] === Infinity) +
          (squareMap[`${squareX}-${squareY + 1}`] === Infinity) +
          (squareMap[`${squareX}-${squareY - 1}`] === Infinity) +
          (squareMap[`${squareX + 1}-${squareY + 1}`] === Infinity) +
          (squareMap[`${squareX + 1}-${squareY - 1}`] === Infinity) +
          (squareMap[`${squareX - 1}-${squareY + 1}`] === Infinity) +
          (squareMap[`${squareX - 1}-${squareY - 1}`] === Infinity);
      }
    }
  }

  //   start the new game's animation
  function startNewGameAnimation(board) {
    let gameStartscreen = document.querySelector(".game-startscreen");
    gameStartscreen.classList.add("disappear");
    gameStartscreen.addEventListener(
      "animationend",
      () => {
        board.classList.remove("startboard");
        gameStartscreen.classList.remove("disappear");
        board.classList.add("gameboard");
        document.documentElement.style.setProperty(
          "--board-width",
          "var(--game-board-width)"
        );
        setTimeout(() => {
          board.classList.add("with-upper-info");
          board.classList.add("with-lower-info");
        }, 1500);
      },
      { once: true }
    );
  }

  // restart the game
  function restartGame() {
    acceptingClicks = false;

    for (let square of document.querySelectorAll(".square.marked")) {
      square.classList.remove("marked");
    }
    for (let square of document.querySelectorAll(".square.pressed")) {
      square.classList.remove("pressed");
      square.removeAttribute("mine-count");
    }

    board.classList.remove("won");
    board.classList.remove("over");

    squareMap = {};
    initialClickOccurred = false;
    flagsRemaining = preferences.mineAmount;
    setCounterValue(
      document.getElementById("flags-remaining-counter"),
      flagsRemaining
    );
    timeElapsed = 0;
    setCounterValue(
      document.getElementById("time-elapsed-counter"),
      timeElapsed
    );
    pressedSquareCount = 0;
    clearInterval(timerInterval);

    for (let square of document.querySelectorAll(".square")) {
      square.removeEventListener("contextmenu", handleSquareRightClick);
      square.removeEventListener("click", handleSquareClick);
      square.addEventListener("contextmenu", handleSquareRightClick);
      square.addEventListener("click", handleSquareClick);
    }

    acceptingClicks = true;
  }

  //   handle victory
  function handleGameWon() {
    clearInterval(timerInterval);
    acceptingClicks = false;
    board.classList.add("won");
  }

  //   handle clicking on a mine
  function handleGameOver() {
    clearInterval(timerInterval);
    acceptingClicks = false;
    board.classList.add("over");
  }

  function explode([sourceX, sourceY]) {
    let delay = 1;
    // t - time, dis - distance
    // let squareColorOpacity = (t, dis) =>
    //   Math.max(0, Math.sin(1.5 * t - (dis + 1.5 * delay)));
    let squareColorOpacity = (t, dis) => Math.abs(Math.cos(1.5 * t - dis));
    let peak = (dis) => (2 * Math.PI) / 3 + dis;
    let valley = (dis) => Math.PI / 3 + dis;

    let time = 0;
    let interval = 0.01;
    let explosionShockWaveEvaluationInterval = setInterval(
      (squares) => {
        for (let square of squares) {
          let squareX = square.getAttribute("square-coord-x");
          let squareY = square.getAttribute("square-coord-y");
          let distance = Math.sqrt(
            Math.abs(sourceX - squareX) + Math.abs(sourceY - squareY)
          );
          let opacity = squareColorOpacity(time, distance);
          square.style.setProperty("opacity", opacity);

          if (time <= valley) {
            square.style.setProperty("opacity", opacity);
          } else if (time <= peak(distance)) {
            square.style.setProperty("background-color", "red");
            square.style.setProperty("opacity", opacity);
          } else if (time <= 2 * peak(distance)) {
            let colorBias = (1 - opacity) * 510;
            let blue = Math.max(0, colorBias - 255);
            let green = Math.max(0, colorBias - blue);
            square.style.setProperty(
              "background-color",
              `rgb(255, ${green}, ${blue})`
            );
            square.style.setProperty("opacity", opacity);
          }

          // if (time >= peak(distance)) {
          //   let colorBias = (1 - opacity) * 510;
          //   let blue = colorBias - 255;
          //   let green = colorBias - blue;
          //   square.style.setProperty(
          //     "background-color",
          //     `rgb(255, ${green}, ${blue})`
          //   );
          // } else {
          //   square.style.setProperty("background-color", "red");
          // }
        }
        time += interval;
      },
      interval * 1000,
      document.getElementsByClassName("square")
    );
  }

  // <- game
  // prettier-ignore
  if (document.readyState === "interactive" || document.readyState === "complete") {
      init();
      document.body.style.visibility = "visible";
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        init();
        document.body.style.visibility = "visible";
      }, { once: true });
    }
})();
