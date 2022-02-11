// [{ "symbol": "COALINDIA", "open": "160.50", "high": "169.35", "low": "160.00", 
// "ltP": "168.95", "ptsC": "9.00", "per": "5.63", "trdVol": "350.80", "trdVolM": "35.08", 
// "ntP": "586.28", "mVal": "5.86", "wkhi": "203.80", "wklo": "123.40", "wkhicm_adj": "423.70", 
// "wklocm_adj": "240.30", "xDt": "06-DEC-2021", "cAct": "INTERIM DIVIDEND - RS 9 PER SH", 
// "previousClose": "159.95", "dayEndClose": "168.6", "iislPtsChange": "8.65", "iislPercChange": "5.41", 
// "yPC": "19.36", "mPC": "5.13" }]

let data = [];
const mapSymbol = {};
const globals = {
    buy: true,
    sell: false,
    shareQuantity: 0,
    targetPrice: 0,
    symbol: null,
    price: null,
}
const assestIndex = {}

const pendingTransaction = [];
const completeTransaction = [];
const assestOwn = [];
const transactionId = {
    pending: -1,
}

function formatNumberString(str) {
    let newStr = "";
    for (let i = 0; i < str.length; i++) {
        if (str[i] == ',') continue;
        newStr = newStr + str[i];
    }
    newStr = Number(newStr).toFixed(2);
    return newStr;
}

function formatCompanyName(str) {
    let newStr = "";
    for (let i = 0; i < str.length; i++) {
        if (str[i] == '-') continue;
        if (str[i] == '&') continue; 
        newStr = newStr + str[i];
    }
    return newStr;
}

async function loadCompanyData() {

    // let response = await fetch(
    //     "https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=fa89ee5629a523a45fb0fe8babb9d28e"
    // );

    let response = await fetch(
        "http://localhost:3000/nse/get_index_stocks?symbol=nifty"
    );

    let reponseData = await response.json();
    data = reponseData.data;

    let loadingDiv = document.querySelector(".company-data .loading");
    loadingDiv && loadingDiv.remove();

    let wrapperDiv = document.querySelector(".company-data .table-content");
    wrapperDiv.innerHTML = "";

    data.forEach(function (obj, index) {

        let change;
        if (obj.iislPtsChange >= 0) {
            change = "change-pos";
        }
        else {
            change = "change-neg";
        }

        obj.symbol = formatCompanyName(obj.symbol);

        // Mapping symbol and index
        mapSymbol[obj.symbol] = index;

        wrapperDiv.innerHTML += (
            `<div class="company-row">
                <p class="company">${obj.symbol}</p>
                <div class="market-price">
                    <p class="price">&#8377;${formatNumberString(obj.ltP)}</p>
                    <p class="${change}">${formatNumberString(obj.iislPtsChange) + "(" + formatNumberString(obj.iislPercChange) + "%)"}</p>
                </div>

                <p class="buy">
                    <button id="${"buy1-" + obj.symbol}" class="buy-button" onclick="buySelect(event)">B</button>
                </p>
                <p class="sell">
                    <button id="${"sell1-" + obj.symbol}" class="sell-button" onclick="sellSelect(event)">S</button>
                </p>
            </div>`);
    });

    //change the price of globals and call loadBuySellForm
    let currentIndex = globals.symbol == null ? 0 : mapSymbol[globals.symbol];
    globals.symbol = data[currentIndex].symbol;
    globals.price = formatNumberString(data[currentIndex].ltP);
    loadBuySellForm();

    checkPendingTransaction();
}

function loadBuySellForm() {

    document.querySelector(".buy-sell-form .company-name").innerHTML = globals.symbol;
    document.querySelector(".buy-sell-market-price").innerHTML = "&#8377;" + globals.price;

    if (globals.buy) {
        document.querySelector(".buy-sell-tab p:nth-child(1)").classList.add("selected");
        document.querySelector(".buy-sell-tab p:nth-child(2)").classList.remove("selected");
        document.querySelector(".buy-sell-button").classList.add("buy-style");
        document.querySelector(".buy-sell-button").classList.remove("sell-style");
        document.querySelector(".buy-sell-button").innerHTML = "BUY";
    }
    else {
        document.querySelector(".buy-sell-tab p:nth-child(1)").classList.remove("selected");
        document.querySelector(".buy-sell-tab p:nth-child(2)").classList.add("selected");
        document.querySelector(".buy-sell-button").classList.add("sell-style");
        document.querySelector(".buy-sell-button").classList.remove("buy-style");
        document.querySelector(".buy-sell-button").innerHTML = "SELL";
    }

    document.querySelector(".buy-sell-button").setAttribute("id", globals.symbol);
    document.querySelector(".buy-sell-button").onclick = buySellTransaction;

    let sharesOwned = 0;
    let company = globals.symbol;
    if(company in assestIndex) {
        let index = assestIndex[company];
        sharesOwned = assestOwn[index].units;
    }
    document.querySelector(".buy-sell-tab .units-owned").innerHTML = "Shares Owned - " + sharesOwned;
}

function buySelect(event) {
    let id = event.target.id;
    let symbol = id.substr(5, id.length);

    globals.buy = true;
    globals.sell = false;
    globals.symbol = symbol;
    let currentIndex = mapSymbol[symbol];
    globals.price = formatNumberString(data[currentIndex].ltP);

    loadBuySellForm();
}

function sellSelect(event) {
    let id = event.target.id;
    let symbol = id.substr(6, id.length);

    globals.buy = false;
    globals.sell = true;
    globals.symbol = symbol;
    let currentIndex = mapSymbol[symbol];
    globals.price = formatNumberString(data[currentIndex].ltP);

    loadBuySellForm();
}

function buySellTransaction(event) {
    if(event.target.innerHTML == "BUY") {
        buyTransaction();
    }
    else if(event.target.innerHTML == "SELL") {
        sellTransaction();
    }
}

function buyTransaction() {
    transactionId.pending++;
    pendingTransaction.unshift({
        type: "B",
        company: globals.symbol,
        targetPrice: globals.targetPrice,
        quantity: globals.shareQuantity,
        total: (parseFloat(globals.targetPrice) * parseFloat(globals.shareQuantity)).toFixed(2),
        pendingId: transactionId.pending,
    });

    let loading = document.querySelector(".pending-transaction .table .no-transaction");
    loading && loading.remove();

    document.querySelector(".pending-transaction .table").innerHTML += (
        `<div class="company-row" id="pend${pendingTransaction[0].pendingId}">
            <p class="transaction-type-buy">B</p>
            <p class="company-name">${pendingTransaction[0].company}</p>
            <p class="target-price">${pendingTransaction[0].targetPrice}</p> 
            <p class="quantity">${pendingTransaction[0].quantity}</p>
            <p class="total">${pendingTransaction[0].total}</p>
        </div>`
    );
}

function sellTransaction() {

    let company = globals.symbol;
    let sellPossible = 0;
    if(company in assestIndex) {
        let index = assestIndex[company];
        if(parseFloat(assestOwn[index].units) >= parseFloat(globals.shareQuantity)) sellPossible = 1;
    }
    
    if(!sellPossible) {
        alert("Not having enough shares!!");
        return;
    }
    
    transactionId.pending++;
    pendingTransaction.unshift({
        type: "S",
        company: globals.symbol,
        targetPrice: globals.targetPrice,
        quantity: globals.shareQuantity,
        total: (parseFloat(globals.targetPrice) * parseFloat(globals.shareQuantity)).toFixed(2),
        pendingId: transactionId.pending,
    });

    let loading = document.querySelector(".pending-transaction .table .no-transaction");
    loading && loading.remove();

    document.querySelector(".pending-transaction .table").innerHTML += (
        `<div class="company-row" id="pend${pendingTransaction[0].pendingId}">
            <p class="transaction-type-sell">S</p>
            <p class="company-name">${pendingTransaction[0].company}</p>
            <p class="target-price">${pendingTransaction[0].targetPrice}</p> 
            <p class="quantity">${pendingTransaction[0].quantity}</p>
            <p class="total">${pendingTransaction[0].total}</p>
        </div>`
    );
}

function pendingTransactionCommon(type, company, targetPrice, quantity, total, pendingId) {
    // delete from pending transaction html
    document.getElementById("pend"+pendingId).remove();

    // add in complete transaction array
    completeTransaction.push({
        type,
        company, 
        targetPrice,
        quantity,
        total, 
    });

    // add in complete transaction html
    let loading = document.querySelector(".completed-transaction .table .no-transaction");
    loading && loading.remove();

    let typeFull;
    if(type === "B") typeFull = "buy";
    else typeFull = "sell";

    let completedTransRow = document.createElement("div");
    completedTransRow.classList.add("company-row");
    completedTransRow.innerHTML = (
        `<p class="transaction-type-${typeFull}">${type}</p>
        <p class="company-name">${company}</p>
        <p class="target-price">${targetPrice}</p>
        <p class="quantity">${quantity}</p>
        <p class="total">${total}</p>`
    )
    document.querySelector(".completed-transaction .table-heading").after(completedTransRow);
}

function checkPendingTransaction() {
    let n = pendingTransaction.length;
    let deleteOperation = 0;

    for(let i=n-1; i>=0; i--) {
        let type = pendingTransaction[i].type;
        let company = pendingTransaction[i].company;
        let targetPrice = pendingTransaction[i].targetPrice;
        let quantity = pendingTransaction[i].quantity;
        let currentPrice = formatNumberString(data[mapSymbol[company]].ltP);
        let total = pendingTransaction[i].total;
        let pendingId = pendingTransaction[i].pendingId;

        // Buy transaction successful
        if(type === "B" && parseFloat(targetPrice) >= parseFloat(currentPrice)) {
            deleteOperation = 1;
            pendingTransactionCommon("B", company, targetPrice, quantity, total, pendingId);

            // add in assets 
            addToAssets(completeTransaction.at(-1));

            // delete from pending transaction array
            pendingTransaction.splice(i, 1);
        }

        // Sell transaction 
        else if(type === "S" && parseFloat(targetPrice) <= parseFloat(currentPrice))
        {
            // Also check for enough shares units
            let sellPossible = 0;
            if(company in assestIndex) {
                let index = assestIndex[company];
                if(parseFloat(assestOwn[index].units) >= parseFloat(quantity)) sellPossible = 1;
            }
            
            if(!sellPossible) continue;

            deleteOperation = 1;
            pendingTransactionCommon("S", company, targetPrice, quantity, total, pendingId);
        
            // Update Assets (Remaining)
            substractFromAssets(completeTransaction.at(-1));

            // delete from pending transaction array
            pendingTransaction.splice(i, 1);
        }
    }

    if(pendingTransaction.length === 0 && deleteOperation) {
        document.querySelector(".pending-transaction .table").innerHTML += (
            `<div class="no-transaction">
                No Pending Transactions
            </div>`
        );
    } 
}

function substractFromAssets(obj) {
    let index = assestIndex[obj.company];

    assestOwn[index].units = parseFloat(assestOwn[index].units) - parseFloat(obj.quantity);
    assestOwn[index].total = (parseFloat(assestOwn[index].total) - parseFloat(obj.total)).toFixed(2);
    
    if(parseFloat(assestOwn[index].units) > 0) {
        let avgPrice = (parseFloat(assestOwn[index].total) / parseFloat(assestOwn[index].units)).toFixed(2);
        let tableRow = document.getElementById("asset" + obj.company);
        tableRow.querySelector(".average-price").innerHTML = avgPrice;
        tableRow.querySelector(".quantity").innerHTML = assestOwn[index].units;
        tableRow.querySelector(".total").innerHTML = assestOwn[index].total;

        loadBuySellForm();
        return;
    }

    // Share = 0, thus remove from assets
    document.getElementById("asset" + obj.company).remove();
    assestOwn[index] = {};
    delete assestIndex[obj.company];
    loadBuySellForm();

    // If assets is empty, Show No Assets
    if(Object.keys(assestIndex).length == 0) {
        document.querySelector(".asset .table").innerHTML += (
            `<div class="no-transaction">
                No Assests
            </div>`
        );
    }
}

function addToAssets(obj) {
    let index;
    if(obj.company in assestIndex) {
        index = assestIndex[obj.company];
        assestOwn[index].units = (parseFloat(assestOwn[index].units) + parseFloat(obj.quantity));
        assestOwn[index].total = (parseFloat(assestOwn[index].total) + parseFloat(obj.total)).toFixed(2);
        assestOwn[index].price = (parseFloat(assestOwn[index].total) / (parseFloat(assestOwn[index].units))).toFixed(2);
    
        // Add in html
        let assestRow = document.getElementById("asset"+obj.company);
        assestRow.querySelector(".average-price").innerHTML = assestOwn[index].price;
        assestRow.querySelector(".quantity").innerHTML = assestOwn[index].units;
        assestRow.querySelector(".total").innerHTML = assestOwn[index].total;
    }
    else {
        index = assestOwn.length;
        assestIndex[obj.company] = index;
        assestOwn[index] = {
            company: obj.company,
            price: obj.targetPrice,
            units: obj.quantity,
            total: obj.total,
        }
    
        // Add in html
        document.querySelector(".asset .table").innerHTML += (
            `<div class="table-row" id="asset${obj.company}" onclick="handleAssetClick(asset${obj.company})">
                <p class="company-name">${obj.company}</p>
                <p class="average-price">${obj.targetPrice}</p>
                <p class="quantity">${obj.quantity}</p>
                <p class="total">${obj.total}</p>
            </div>`
        );

        let emptyDiv = document.querySelector(".asset .no-transaction");
        emptyDiv && emptyDiv.remove();
    }

    loadBuySellForm();
}

function handleAssetClick(event) {
    let len = event.id.length;
    company = event.id.substr(5, len);
    
    globals.buy = false;
    globals.sell = true;
    globals.symbol = company;
    let currentIndex = mapSymbol[company];
    globals.price = formatNumberString(data[currentIndex].ltP);

    loadBuySellForm();
}

setInterval(loadCompanyData, 3000);

// handleQuantityChange
const handleQuantityChange = document.querySelector(".buy-sell-form .quantity-input");

handleQuantityChange.addEventListener("change", event => {
    let value = event.target.value;
    globals.shareQuantity = value;
});

// handleTargetPrice
const handleTargetPrice = document.querySelector(".buy-sell-target-price .target-price-input");

handleTargetPrice.addEventListener("change", event => {
    let value = event.target.value;
    globals.targetPrice = Number(value).toFixed(2);
})