// --- State Management ---
const STORAGE_KEY = 'sipvault_data';

function getDrinks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveDrinks(drinks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drinks));
}

// --- DOM References ---
const drinkGrid = document.getElementById('drink-grid');
const addDrinkBtn = document.getElementById('add-drink-btn');
const modalOverlay = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal');
const addDrinkForm = document.getElementById('add-drink-form');
const sortSelect = document.getElementById('sort-select');
const filterTypeSelect = document.getElementById('filter-type-select');
const spiritFilterGroup = document.getElementById('spirit-filter-group');
const filterSpiritSelect = document.getElementById('filter-spirit-select');
const filterSpiritOther = document.getElementById('filter-spirit-other');
const ratingFilterGroup = document.getElementById('rating-filter-group');
const filterMinRating = document.getElementById('filter-min-rating');
const beerFilterGroup = document.getElementById('beer-filter-group');
const filterBeerType = document.getElementById('filter-beer-type');
// Dynamic Form Elements
const categorySelect = document.getElementById('drink-category');
const dynamicFieldsContainer = document.getElementById('dynamic-fields');
const ratingInput = document.getElementById('drink-rating');
const stars = document.querySelectorAll('.ri-star-line');
const drinkImageInput = document.getElementById('drink-image');

// Photo Upload Elements
const triggerCameraBtn = document.getElementById('trigger-camera-btn');
const drinkImageFile = document.getElementById('drink-image-file');
const cameraPreviewContainer = document.getElementById('camera-preview-container');
const cameraPreview = document.getElementById('camera-preview');
const removePhotoBtn = document.getElementById('remove-photo-btn');
let currentImageBase64 = null;

// Search
const globalSearchInput = document.getElementById('global-search');

// --- App Initialization ---
function init() {
    updateFiltersForCategory();
    renderDrinks();
    setupEventListeners();
}

// --- Event Listeners ---
function setupEventListeners() {
    // --- Modal Logic ---
    addDrinkBtn.addEventListener('click', () => {
        addDrinkForm.reset();
        resetStars();
        updateDynamicFields();
        resetFetchPreview();
        resetCameraPreview();
        modalOverlay.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
    });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });

    // --- Dynamic Form Updates ---
    categorySelect.addEventListener('change', updateDynamicFields);

    // Dynamic field event delegation for the "Other" spirit selection
    dynamicFieldsContainer.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'drink-spirit-base') {
            const otherGroup = document.getElementById('spirit-other-group');
            const otherInput = document.getElementById('drink-spirit-other');
            if (otherGroup) {
                if (e.target.value === 'Other') {
                    otherGroup.classList.remove('hidden');
                    otherInput.setAttribute('required', 'true');
                } else {
                    otherGroup.classList.add('hidden');
                    otherInput.removeAttribute('required');
                    otherInput.value = '';
                }
            }
        }
    });

    // --- Star Rating ---
    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const val = this.getAttribute('data-val');
            highlightStars(val);
        });
        
        star.addEventListener('mouseout', function() {
            highlightStars(ratingInput.value);
        });

        star.addEventListener('click', function() {
            const val = this.getAttribute('data-val');
            ratingInput.value = val;
            highlightStars(val);
        });
    });

    // --- Form Submission ---
    addDrinkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if(ratingInput.value == "0") {
            alert("Please select a rating!");
            return;
        }

        const formData = new FormData(addDrinkForm);
        const category = formData.get('category');
        
        let finalImage = currentImageBase64 || formData.get('image').trim() || '';

        let derivedName = '';
        if (category === 'spirit') {
            const maker = formData.get('maker') ? formData.get('maker').trim() : '';
            const subtype = formData.get('subtype') ? formData.get('subtype').trim() : '';
            derivedName = `${maker} ${subtype}`.trim() || 'Unknown Spirit';
        } else {
            derivedName = formData.get('name') ? formData.get('name').trim() : 'Unknown Drink';
        }

        const newDrink = {
            id: Date.now().toString(),
            name: derivedName,
            category: category,
            rating: parseInt(formData.get('rating')),
            image: finalImage,
            dateAdded: new Date().toISOString()
        };

        if (category === 'beer') {
            newDrink.subtype = formData.get('subtype') ? formData.get('subtype').trim() : '';
            newDrink.maker = formData.get('maker') ? formData.get('maker').trim() : '';
        } else if (category === 'spirit') {
            newDrink.maker = formData.get('maker') ? formData.get('maker').trim() : '';
            newDrink.subtype = formData.get('subtype') ? formData.get('subtype').trim() : '';
            newDrink.location = formData.get('location') ? formData.get('location').trim() : '';
            
            let base = formData.get('spiritBase');
            if (base === 'Other') base = formData.get('spiritOther').trim();
            newDrink.spiritType = base || '';
            
        } else if (category === 'cocktail') {
            newDrink.description = formData.get('description') ? formData.get('description').trim() : '';
            newDrink.location = formData.get('location') ? formData.get('location').trim() : '';
            
            let base = formData.get('spiritBase');
            if (base === 'Other') base = formData.get('spiritOther').trim();
            newDrink.spiritType = base || '';
        }

        const drinks = getDrinks();
        drinks.push(newDrink);
        saveDrinks(drinks);
        
        modalOverlay.classList.add('hidden');
        renderDrinks();
    });

    // --- Filters & Sorting ---
    sortSelect.addEventListener('change', renderDrinks);
    filterTypeSelect.addEventListener('change', () => {
        updateFiltersForCategory();
        renderDrinks();
    });

    filterSpiritSelect.addEventListener('change', () => {
        if (filterSpiritSelect.value === 'Other') {
            filterSpiritOther.style.display = 'block';
        } else {
            filterSpiritOther.style.display = 'none';
            filterSpiritOther.value = '';
        }
        renderDrinks();
    });
    
    if(filterSpiritOther) filterSpiritOther.addEventListener('input', renderDrinks);
    if(filterMinRating) filterMinRating.addEventListener('change', renderDrinks);
    if(filterBeerType) filterBeerType.addEventListener('input', renderDrinks);

    // --- Magic Fetch Function ---
    magicFetchBtn.addEventListener('click', performFetch);
    applyFetchBtn.addEventListener('click', applyFetchedData);
    
    // Auto-search on enter key inside the input
    drinkNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performFetch();
        }
    });

    // --- Search & Camera Event Listeners ---
    if(globalSearchInput) globalSearchInput.addEventListener('input', renderDrinks);

    if(triggerCameraBtn) {
        triggerCameraBtn.addEventListener('click', () => {
            drinkImageFile.click();
        });
    }

    if(drinkImageFile) {
        drinkImageFile.addEventListener('change', handleFileUpload);
    }
    
    if(removePhotoBtn) {
        removePhotoBtn.addEventListener('click', () => {
            resetCameraPreview();
            drinkImageFile.value = '';
        });
    }
}

// --- Dynamic Filter Updating ---
function updateFiltersForCategory() {
    const val = filterTypeSelect.value;
    
    // Reset inputs
    filterSpiritSelect.value = '';
    filterSpiritOther.style.display = 'none';
    filterSpiritOther.value = '';
    filterBeerType.value = '';
    filterMinRating.value = '0';
    
    // Update Sorting Options
    sortSelect.innerHTML = '';
    const addOption = (value, text) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        sortSelect.appendChild(opt);
    };

    if (val === 'all') {
        addOption('recent', 'Recently Added');
        addOption('rating', 'Highest Rated');
        addOption('rating-desc', 'Lowest Rated');
        addOption('name', 'Name (A-Z)');
        addOption('location', 'Location');
    } else if (val === 'cocktail') {
        addOption('name', 'Name (A-Z)');
        addOption('spirit-type', 'Spirit Type');
        addOption('rating', 'Highest Rated');
        addOption('rating-desc', 'Lowest Rated');
    } else if (val === 'beer') {
        addOption('name', 'Name (A-Z)');
        addOption('rating', 'Highest Rated');
        addOption('rating-desc', 'Lowest Rated');
        addOption('recent', 'Recently Added');
    } else if (val === 'spirit') {
        addOption('name', 'Name (A-Z)');
        addOption('rating', 'Highest Rated');
        addOption('rating-desc', 'Lowest Rated');
        addOption('recent', 'Recently Added');
    }

    // Toggle filter groups
    spiritFilterGroup.style.display = 'none';
    beerFilterGroup.style.display = 'none';
    ratingFilterGroup.style.display = 'none';

    if (val === 'all') {
        spiritFilterGroup.style.display = 'flex';
    } else if (val === 'beer') {
        beerFilterGroup.style.display = 'flex';
        ratingFilterGroup.style.display = 'flex';
    } else if (val === 'cocktail') {
        // Cocktails mainly rely on sorting, but keep rating filter available
        ratingFilterGroup.style.display = 'flex'; 
    } else if (val === 'spirit') {
        spiritFilterGroup.style.display = 'flex';
        ratingFilterGroup.style.display = 'flex';
    }
}

// --- Camera / Photo Compression ---
function resetCameraPreview() {
    currentImageBase64 = null;
    if(cameraPreviewContainer) cameraPreviewContainer.classList.add('hidden');
    if(cameraPreview) cameraPreview.src = '';
    if(drinkImageInput) drinkImageInput.disabled = false;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Compress Image via Canvas
            const MAX_WIDTH = 600;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality JPEG
            currentImageBase64 = compressedBase64;
            
            // Show Preview
            cameraPreview.src = compressedBase64;
            cameraPreviewContainer.classList.remove('hidden');
            
            // Disable URL input
            drinkImageInput.disabled = true;
            drinkImageInput.value = '';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

const spiritOptionsCombo = `
    <option value="">Select...</option>
    <option value="Whiskey">Whiskey</option>
    <option value="Vodka">Vodka</option>
    <option value="Rum">Rum</option>
    <option value="Tequila">Tequila</option>
    <option value="Gin">Gin</option>
    <option value="Brandy">Brandy</option>
    <option value="Other">Other...</option>
`;

// --- Dynamic Form Builder ---
function updateDynamicFields() {
    const category = categorySelect.value;
    dynamicFieldsContainer.innerHTML = ''; // Clear

    if (category === 'beer') {
        dynamicFieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="drink-name" style="color: var(--primary-color);">Entry Name</label>
                <input type="text" id="drink-name" name="name" placeholder="e.g. Guinness, All Day IPA" required>
            </div>
            <div class="form-group">
                <label for="drink-subtype">Type of Beer</label>
                <input type="text" id="drink-subtype" name="subtype" placeholder="e.g. Stout, IPA, Lager...">
            </div>
            <div class="form-group">
                <label for="drink-maker">Brewery Name</label>
                <input type="text" id="drink-maker" name="maker" placeholder="e.g. Guinness St. James's Gate">
            </div>
        `;
    } else if (category === 'spirit') {
        dynamicFieldsContainer.innerHTML = `
            <div class="form-row">
                <div class="form-group w-50">
                    <label for="drink-spirit-base">Primary Spirit</label>
                    <select id="drink-spirit-base" name="spiritBase" required>
                        ${spiritOptionsCombo}
                    </select>
                </div>
                <div class="form-group w-50 hidden" id="spirit-other-group">
                    <label for="drink-spirit-other">Custom Spirit</label>
                    <input type="text" id="drink-spirit-other" name="spiritOther" placeholder="e.g. Absinthe">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group w-50">
                    <label for="drink-maker">Maker / Brand</label>
                    <input type="text" id="drink-maker" name="maker" placeholder="e.g. Weller">
                </div>
                <div class="form-group w-50">
                    <label for="drink-subtype">Specific Type or Blend</label>
                    <input type="text" id="drink-subtype" name="subtype" placeholder="e.g. Special Reserve">
                </div>
            </div>
            <div class="form-group">
                <label for="drink-location">Location Bought</label>
                <input type="text" id="drink-location" name="location" placeholder="e.g. Local Liquor Store">
            </div>
        `;
    } else if (category === 'cocktail') {
        dynamicFieldsContainer.innerHTML = `
            <div class="form-group">
                <label for="drink-name" style="color: var(--primary-color);">Cocktail Name</label>
                <input type="text" id="drink-name" name="name" placeholder="e.g. Old Fashioned, Margarita" required>
            </div>
            <div class="form-group">
                <label for="drink-location">Bar Name / Made By <i class="ri-map-pin-line"></i></label>
                <input type="text" id="drink-location" name="location" placeholder="e.g. Mother's Ruin, Home">
            </div>
            <div class="form-row">
                <div class="form-group w-50">
                    <label for="drink-spirit-base">Primary Spirit (For filtering)</label>
                    <select id="drink-spirit-base" name="spiritBase">
                        ${spiritOptionsCombo}
                    </select>
                </div>
                <div class="form-group w-50 hidden" id="spirit-other-group">
                    <label for="drink-spirit-other">Custom Spirit</label>
                    <input type="text" id="drink-spirit-other" name="spiritOther" placeholder="e.g. Mezcal">
                </div>
            </div>
            <div class="form-group">
                <label for="drink-description">Tasting Notes & Ingredients</label>
                <textarea id="drink-description" name="description" placeholder="e.g. Rich, oaky, complex hints of vanilla..."></textarea>
            </div>
        `;
    }
}

// --- Star UI Helper ---
function resetStars() {
    ratingInput.value = "0";
    stars.forEach(s => s.classList.remove('active', 'hover'));
}

function highlightStars(val) {
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute('data-val'));
        if (starVal <= val) {
            star.classList.replace('ri-star-line', 'ri-star-fill');
            star.style.color = 'var(--accent-beer)';
        } else {
            star.classList.replace('ri-star-fill', 'ri-star-line');
            star.style.color = 'rgba(255,255,255,0.2)';
        }
    });
}

// --- Rendering Logic ---
function renderDrinks() {
    let drinks = getDrinks();

    // 1. Filter by Category
    const typeFilter = filterTypeSelect.value;
    if (typeFilter !== 'all') {
        drinks = drinks.filter(d => d.category === typeFilter);
    }

    // 2. Filter by Spirit Type
    let spiritFilter = filterSpiritSelect.value;
    if (spiritFilter === 'Other') {
        spiritFilter = filterSpiritOther.value;
    }
    spiritFilter = spiritFilter.toLowerCase().trim();

    if (spiritFilter) {
        drinks = drinks.filter(d => {
            if ((d.category === 'cocktail' || d.category === 'spirit') && d.spiritType) {
                return d.spiritType.toLowerCase().includes(spiritFilter);
            }
            // For older entries before the update or just broadly searching subtype
            if (d.category === 'spirit' && d.subtype) {
                return d.subtype.toLowerCase().includes(spiritFilter);
            }
            return false;
        });
    }

    // 3. New Filter: By Minimum Rating
    const minR = parseInt(filterMinRating.value) || 0;
    if (minR > 0) {
        drinks = drinks.filter(d => d.rating >= minR);
    }

    // 4. New Filter: By Beer Type
    const beerT = filterBeerType.value.toLowerCase().trim();
    if (beerT && typeFilter === 'beer') {
        drinks = drinks.filter(d => d.category === 'beer' && d.subtype && d.subtype.toLowerCase().includes(beerT));
    }

    // 5. Global Text Search
    if (globalSearchInput && globalSearchInput.value) {
        const searchStr = globalSearchInput.value.toLowerCase().trim();
        drinks = drinks.filter(d => {
            const tags = [
                d.name,
                d.maker,
                d.location,
                d.subtype,
                d.description,
                d.spiritType
            ].filter(Boolean).map(s => s.toLowerCase());
            
            return tags.some(t => t.includes(searchStr));
        });
    }

    // 6. Sorting
    const sortBy = sortSelect.value;
    if (sortBy === 'recent') {
        drinks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    } else if (sortBy === 'rating') {
        drinks.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'rating-desc') {
        drinks.sort((a, b) => a.rating - b.rating);
    } else if (sortBy === 'location') {
        drinks.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
    } else if (sortBy === 'name') {
        drinks.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'spirit-type') {
        drinks.sort((a, b) => (a.spiritType || '').localeCompare(b.spiritType || ''));
    }

    drinkGrid.innerHTML = '';
    
    if (drinks.length === 0) {
        drinkGrid.innerHTML = `
            <div class="empty-state">
                <i class="ri-search-eye-line"></i>
                <h3>No drinks found</h3>
                <p>Try adjusting your filters or add a new entry.</p>
            </div>
        `;
        return;
    }

    drinks.forEach(drink => {
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container';

        const deleteAction = document.createElement('div');
        deleteAction.className = 'swipe-delete-action';
        deleteAction.innerHTML = '<i class="ri-delete-bin-line"></i> Delete';
        deleteAction.onclick = () => deleteDrink(drink.id);

        const card = document.createElement('div');
        card.className = `drink-card type-${drink.category}`;
        
        // Touch events for swipe to delete
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isSwiping = true;
            card.style.transition = 'none';
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;

            if (diffX < 0) {
                // Swipe left
                const translateX = Math.max(diffX, -100); // cap max swipe
                card.style.transform = `translateX(${translateX}px)`;
            } else {
                card.style.transform = `translateX(0px)`;
            }
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            isSwiping = false;
            card.style.transition = 'transform 0.3s ease-out';
            if (currentX > 0 && startX - currentX > 50) {
                card.style.transform = `translateX(-80px)`; // SNAP OPEN
            } else {
                card.style.transform = `translateX(0px)`; // SNAP CLOSED
            }
            startX = 0; currentX = 0;
        });
        
        let metaHtml = '';
        let titleHtml = '';
        let descHtml = '';

        if (drink.category === 'cocktail') {
            titleHtml = `
                <h3 class="card-title cocktail-title">
                    <span class="drink-primary-name">${drink.name}</span>
                    ${drink.location ? `<span class="drink-at-text"> at </span><span class="drink-location-name">${drink.location}</span>` : ''}
                </h3>
            `;
            if (drink.description) {
                descHtml = `<p class="card-desc italic-notes">"${drink.description.substring(0, 150)}${drink.description.length > 150 ? '...' : ''}"</p>`;
            }
        } else {
            // For Beer/Spirit
            const makerName = drink.maker || (drink.category === 'beer' ? drink.location : '') || 'Unknown Maker';
            titleHtml = `
                <div class="card-title-group">
                    <span class="card-maker-subtitle"><i class="ri-building-4-line"></i> ${makerName}</span>
                    <h3 class="card-title">${drink.name}</h3>
                </div>
            `;
            if (drink.category === 'spirit' && drink.location) {
                metaHtml = `<div class="card-meta"><i class="ri-store-2-line"></i> Bought at: ${drink.location}</div>`;
            }
        }

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= drink.rating) {
                starsHtml += '<i class="ri-star-fill"></i>';
            } else {
                starsHtml += '<i class="ri-star-line empty"></i>';
            }
        }

        let typeTag = '';
        if (drink.category === 'cocktail' && drink.spiritType) {
            typeTag = `<span class="tag">Spirit: ${drink.spiritType}</span>`;
        } else if (drink.category === 'spirit') {
            const types = [];
            if(drink.spiritType) types.push(drink.spiritType);
            if(drink.subtype) types.push(drink.subtype);
            if(types.length) typeTag = `<span class="tag">${types.join(' - ')}</span>`;
        } else if (drink.category === 'beer' && drink.subtype) {
            typeTag = `<span class="tag">${drink.subtype}</span>`;
        }

        let iconPlaceholder = 'ri-goblet-fill';
        if(drink.category === 'beer') iconPlaceholder = 'ri-beer-fill';
        if(drink.category === 'cocktail') iconPlaceholder = 'ri-cup-fill';

        const imgHtml = drink.image 
            ? `<img src="${drink.image}" alt="${drink.name}">`
            : `<div class="card-image-placeholder"><i class="${iconPlaceholder}"></i></div>`;

        // Notice we removed the absolute cross button for mobile natively, retaining it inside for desktop fallback
        card.innerHTML = `
            <div class="card-accent"></div>
            <button class="delete-btn desktop-only" onclick="deleteDrink('${drink.id}')" title="Delete"><i class="ri-delete-bin-line"></i></button>
            <div class="card-image">
                ${imgHtml}
            </div>
            <div class="card-content">
                <div class="card-header">
                    ${titleHtml}
                    <div class="card-rating">${starsHtml}</div>
                </div>
                <div class="card-tags">
                    <span class="tag type">${drink.category}</span>
                    ${typeTag}
                </div>
                ${metaHtml}
                ${descHtml}
            </div>
        `;
        
        swipeContainer.appendChild(deleteAction);
        swipeContainer.appendChild(card);
        drinkGrid.appendChild(swipeContainer);
    });

    // Update recommendations after render
    generateRecommendations();
}

window.deleteDrink = function(id) {
    if(confirm('Are you sure you want to delete this entry?')) {
        let drinks = getDrinks();
        drinks = drinks.filter(d => d.id !== id);
        saveDrinks(drinks);
        renderDrinks();
    }
};

// --- Recommendation Engine ---
const RECOMMENDATION_DB = [
    { name: "Guinness Draught", maker: "St. James's Gate", category: "beer", subtype: "Stout", desc: "The legendary Irish dry stout. Velvety, rich, and creamy." },
    { name: "Founders Breakfast Stout", maker: "Founders Brewing Co.", category: "beer", subtype: "Stout", desc: "Brewed with an abundance of flaked oats, bitter and imported chocolates, and coffee." },
    { name: "Two Hearted Ale", maker: "Bell's Brewery", category: "beer", subtype: "IPA", desc: "Bursting with hop aromas ranging from pine to grapefruit." },
    { name: "Pliny the Elder", maker: "Russian River Brewing", category: "beer", subtype: "Double IPA", desc: "A true classic Double IPA. Well-balanced with floral, citrus, and pine notes." },
    { name: "Old Fashioned", location: "Classic Recipe", category: "cocktail", spiritType: "Whiskey", desc: "Whiskey, sugar, bitters, and water. The ultimate classic." },
    { name: "Manhattan", location: "Classic Recipe", category: "cocktail", spiritType: "Whiskey", desc: "Rye whiskey, sweet vermouth, and Angostura bitters." },
    { name: "Margarita", location: "Classic Recipe", category: "cocktail", spiritType: "Tequila", desc: "Tequila, triple sec, and lime juice. Simple and refreshing." },
    { name: "Paloma", location: "Classic Recipe", category: "cocktail", spiritType: "Tequila", desc: "Tequila and grapefruit soda. Incredibly popular down south." },
    { name: "Lagavulin 16 Year", maker: "Lagavulin", category: "spirit", subtype: "Single Malt Scotch", spiritType: "Whiskey", desc: "Intense, smoky, and richly peated Islay single malt." },
    { name: "Buffalo Trace", maker: "Buffalo Trace", category: "spirit", subtype: "Kentucky Straight Bourbon", spiritType: "Whiskey", desc: "A deep amber whiskey with complex aromas of vanilla, mint and molasses." },
    { name: "Hendrick's Gin", maker: "Hendrick's", category: "spirit", subtype: "Gin", spiritType: "Gin", desc: "Infused with rose and cucumber for a truly unique floral profile." },
    { name: "Negroni", location: "Classic Recipe", category: "cocktail", spiritType: "Gin", desc: "Equal parts Gin, Vermouth Rosso, and Campari. Bitter-sweet perfection." },
    { name: "Daiquiri", location: "Classic Recipe", category: "cocktail", spiritType: "Rum", desc: "Just Rum, citrus juice, and sweetener. True balance." },
    { name: "Aperol Spritz", location: "Classic Recipe", category: "cocktail", spiritType: "Other", desc: "Aperol, Prosecco, and a splash of soda water. Perfect for summer." }
];

function generateRecommendations() {
    const container = document.getElementById('recommendations-container');
    const carousel = document.getElementById('recommendations-carousel');
    
    if (!container || !carousel) return;

    let drinks = getDrinks() || [];
    
    const vaultNames = drinks.map(d => d.name.toLowerCase());
    let availableRecs = RECOMMENDATION_DB.filter(rec => !vaultNames.includes(rec.name.toLowerCase()));
    
    const highlyRated = drinks.filter(d => d.rating >= 4);
    
    let chosenRecs = [];
    
    if (highlyRated.length === 0) {
        // Random generic classics if no top ratings
        chosenRecs = availableRecs.sort(() => 0.5 - Math.random()).slice(0, 4);
    } else {
        let prefCounts = {};
        highlyRated.forEach(drink => {
            let key = drink.category; 
            if (drink.category === 'beer' && drink.subtype) key += ':' + drink.subtype;
            if (drink.category !== 'beer' && drink.spiritType) key += ':' + drink.spiritType;
            
            prefCounts[key] = (prefCounts[key] || 0) + 1;
        });
        
        const sortedPrefs = Object.entries(prefCounts).sort((a,b) => b[1] - a[1]);
        const topPrefKey = sortedPrefs[0][0]; 
        
        const [topCat, topType] = topPrefKey.split(':');
        
        let matches = availableRecs.filter(r => r.category === topCat && (r.subtype === topType || r.spiritType === topType));
        
        if (matches.length < 4) {
            let partialMatches = availableRecs.filter(r => r.category === topCat && !matches.includes(r));
            matches = [...matches, ...partialMatches];
        }
        
        if (matches.length < 4) {
            let others = availableRecs.filter(r => !matches.includes(r));
            matches = [...matches, ...others];
        }
        
        // Deduplicate the array by name just in case
        chosenRecs = Array.from(new Set(matches.map(a => a.name)))
            .map(name => matches.find(a => a.name === name))
            .slice(0, 4);
    }
    
    if (chosenRecs.length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    carousel.innerHTML = '';
    
    chosenRecs.forEach(rec => {
        let makerHtml = '';
        if (rec.maker) makerHtml = `<div class="maker-text"><i class="ri-building-4-line"></i> ${rec.maker}</div>`;
        else if (rec.location) makerHtml = `<div class="maker-text"><i class="ri-map-pin-line"></i> ${rec.location}</div>`;
        
        const miniCard = document.createElement('div');
        miniCard.className = `mini-card type-${rec.category}`;
        
        miniCard.innerHTML = `
            <div class="pill-badge">${rec.category}</div>
            <h3>${rec.name}</h3>
            ${makerHtml}
            <p class="desc-text">"${rec.desc}"</p>
        `;
        carousel.appendChild(miniCard);
    });
}

// --- Kickoff ---

// Kickoff
init();
